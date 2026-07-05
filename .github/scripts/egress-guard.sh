#!/usr/bin/env bash
# egress-guard.sh — monitorización/bloqueo de conexiones salientes del runner,
# SIN depender de acciones de terceros (p.ej. harden-runner). Pensado para
# runners Linux hospedados por GitHub, que traen iptables y sudo sin contraseña.
#
# Filosofía: "assume breach". Si una action comprometida logra ejecutarse en el
# runner (aunque la fijemos por SHA), su siguiente paso es abrir una conexión a un
# C2 para exfiltrar secrets. Este guard deja rastro de ESA conexión (audit) o la
# corta de raíz (block).
#
# Subcomandos:
#   arm-audit   Registra (LOG) toda conexión saliente NUEVA. NO bloquea: el target
#               LOG de iptables no descarta el paquete, así que es imposible que
#               rompa el build. Solo deja huella en el kernel log.
#   arm-block   Deja pasar únicamente loopback, DNS, conexiones ya establecidas y
#               los endpoints de .github/egress-allowlist.txt; DROP + LOG del resto.
#               OJO: frágil con CDNs (sus IPs rotan). Usar solo en jobs de egress
#               acotado y tras revisar la salida de 'report'.
#   report      Resume los destinos salientes observados (IP:puerto -> PTR). Solo
#               monitoriza: siempre termina en 0.
#
# Requiere privilegios: invocar con sudo. Uso:
#   sudo .github/scripts/egress-guard.sh arm-audit
#   sudo .github/scripts/egress-guard.sh report

set -euo pipefail

PREFIX="EGRESS_GUARD: "
ALLOWLIST="${GITHUB_WORKSPACE:-.}/.github/egress-allowlist.txt"

read_kernel_log() {
  # En runners de GitHub el log del kernel (donde escribe iptables LOG) se lee con
  # dmesg; journalctl -k es el respaldo si dmesg está restringido.
  dmesg 2>/dev/null || journalctl -k --no-pager 2>/dev/null || true
}

resolve_allowlist_ips() {
  [ -f "$ALLOWLIST" ] || return 0
  grep -vE '^[[:space:]]*(#|$)' "$ALLOWLIST" | while read -r host _; do
    [ -z "$host" ] && continue
    if [[ "$host" =~ ^[0-9.]+(/[0-9]+)?$ ]]; then
      echo "$host"                                   # ya es IP o CIDR literal
    else
      getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u
    fi
  done
}

arm_audit() {
  # Regla no terminante: el paquete sigue su curso, solo se registra.
  iptables -I OUTPUT -m conntrack --ctstate NEW -p tcp \
    -j LOG --log-prefix "$PREFIX" --log-level 4
  echo "egress-guard: modo AUDIT activo (registrando conexiones salientes nuevas)."
}

arm_block() {
  iptables -A OUTPUT -o lo -j ACCEPT
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -A OUTPUT -p udp --dport 53 -j ACCEPT      # DNS
  iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
  local ip
  resolve_allowlist_ips | sort -u | while read -r ip; do
    [ -n "$ip" ] && iptables -A OUTPUT -d "$ip" -j ACCEPT
  done
  iptables -A OUTPUT -j LOG --log-prefix "$PREFIX" --log-level 4
  iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited
  echo "egress-guard: modo BLOCK activo (solo allowlist + DNS + established)."
}

report() {
  local seen
  seen="$(read_kernel_log | grep -F "$PREFIX" || true)"
  if [ -z "$seen" ]; then
    echo "egress-guard: sin conexiones salientes registradas."
    return 0
  fi
  echo "egress-guard: destinos salientes observados"
  echo "  IP:PUERTO              PTR"
  echo "$seen" \
    | grep -oE 'DST=[0-9.]+ .*DPT=[0-9]+' \
    | sed -E 's/.*DST=([0-9.]+).*DPT=([0-9]+).*/\1:\2/' \
    | sort -u \
    | while read -r dst; do
        ip="${dst%%:*}"
        ptr="$(getent hosts "$ip" 2>/dev/null | awk '{print $2}' | head -1)"
        printf '  %-21s %s\n' "$dst" "${ptr:-<sin PTR>}"
      done
  return 0
}

case "${1:-}" in
  arm-audit) arm_audit ;;
  arm-block) arm_block ;;
  report)    report ;;
  *)
    echo "uso: $0 {arm-audit|arm-block|report}" >&2
    exit 2
    ;;
esac
