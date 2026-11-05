/** Ilerleme cubugu: %80'de uyari, %100'de asim rengi (goal: birikimde hep olumlu renk) */
export default function Progress({ ratio, goal }: { ratio: number; goal?: boolean }) {
  const pct = Math.min(100, Math.round(ratio * 100));
  const level = goal ? 'ok' : ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok';
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar ${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
