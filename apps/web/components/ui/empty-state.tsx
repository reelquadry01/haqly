export function EmptyState({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: "neutral" | "finance" | "procurement" | "inventory" | "payroll" | "reports" | "sales";
}) {
  return (
    <div className={`empty-state empty-state--${tone}`}>
      <div className="empty-state__visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}
