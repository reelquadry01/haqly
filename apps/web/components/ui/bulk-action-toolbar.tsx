"use client";

export function BulkActionToolbar({
  count,
  actions,
  onAction,
}: {
  count: number;
  actions: string[];
  onAction: (action: string) => void;
}) {
  if (!count || actions.length === 0) {
    return null;
  }

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <span>{count} selected</span>
      <div>
        {actions.map((label) => (
          <button key={label} type="button" className="ghost-button small" onClick={() => onAction(label)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
