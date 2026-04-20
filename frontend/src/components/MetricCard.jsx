export default function MetricCard({ label, value, tone = 'normal' }) {
  const toneClass = tone === 'danger' ? 'text-red-700' : tone === 'money' ? 'text-signal' : 'text-coal';

  return (
    <div className="glass glass-card p-4">
      <div className="text-sm font-medium" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
