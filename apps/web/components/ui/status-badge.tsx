const statusClassMap: Record<string, string> = {
  // TitleCase variants
  Draft:      "status-badge draft",
  Pending:    "status-badge pending",
  Submitted:  "status-badge submitted",
  Approved:   "status-badge approved",
  Rejected:   "status-badge rejected",
  Posted:     "status-badge posted",
  Reversed:   "status-badge reversed",
  Overdue:    "status-badge overdue",
  Closed:     "status-badge closed",
  Archived:   "status-badge archived",
  Cancelled:  "status-badge cancelled",
  Active:     "status-badge active",
  Inactive:   "status-badge inactive",
  Terminated: "status-badge terminated",
  // UPPERCASE API variants
  DRAFT:      "status-badge draft",
  PENDING:    "status-badge pending",
  SUBMITTED:  "status-badge submitted",
  APPROVED:   "status-badge approved",
  REJECTED:   "status-badge rejected",
  POSTED:     "status-badge posted",
  REVERSED:   "status-badge reversed",
  CANCELLED:  "status-badge cancelled",
  ACTIVE:     "status-badge active",
  INACTIVE:   "status-badge inactive",
  TERMINATED: "status-badge terminated",
};

function toLabel(status: string): string {
  // SCREAMING_SNAKE → Title Case
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={statusClassMap[status] ?? "status-badge draft"}>
      {toLabel(status)}
    </span>
  );
}
