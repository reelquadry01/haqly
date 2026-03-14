import type { KpiMetric } from "../../lib/erp";

export type UiTone =
  | "finance"
  | "procurement"
  | "inventory"
  | "payroll"
  | "sales"
  | "reports"
  | "admin"
  | "assets"
  | "loans"
  | "company"
  | "neutral";

export function KpiCard({
  metric,
  tone = "neutral",
}: {
  metric: KpiMetric;
  tone?: UiTone;
}) {
  return (
    <article className={`surface kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__head">
        <span className="kpi-card__label">{metric.label}</span>
        <span className={`kpi-card__delta ${metric.trend}`}>{metric.delta}</span>
      </div>
      <strong className="kpi-card__value">{metric.value}</strong>
      <p className="kpi-card__detail">{metric.detail}</p>
    </article>
  );
}
