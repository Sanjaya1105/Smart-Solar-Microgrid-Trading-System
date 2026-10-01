import { Activity } from "lucide-react";

export function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`metric-card ${accent}`}>
      <div className="metric-top">
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
