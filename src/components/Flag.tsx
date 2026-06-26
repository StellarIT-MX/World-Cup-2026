import type { Team } from '../domain/types';

export function Flag({ team, size = 20 }: { team?: Team | null; size?: number }) {
  if (!team) {
    return <span className="flag flag--empty" style={{ width: size, height: size * 0.7 }} />;
  }
  return (
    <img
      className="flag"
      src={team.flag}
      alt={team.code}
      width={size}
      height={size * 0.7}
      loading="lazy"
    />
  );
}
