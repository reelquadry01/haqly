import type { AppStatus } from "../../lib/erp";

const statusClassMap: Record<AppStatus, string> = {
  Draft: "status-badge draft",
  Pending: "status-badge pending",
  Submitted: "status-badge submitted",
  Approved: "status-badge approved",
  Rejected: "status-badge rejected",
  Posted: "status-badge posted",
  Reversed: "status-badge reversed",
  Overdue: "status-badge overdue",
  Closed: "status-badge closed",
  Archived: "status-badge archived",
};

export function StatusBadge({ status }: { status: AppStatus }) {
  return <span className={statusClassMap[status] ?? "status-badge"}>{status}</span>;
}
