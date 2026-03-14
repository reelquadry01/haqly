import type { ApprovalStep as ApprovalStepType } from "../../lib/erp";
import { StatusBadge } from "./status-badge";

export function ApprovalStepper({
  steps,
  onApprove,
  onReject,
  busyId,
}: {
  steps: ApprovalStepType[];
  onApprove?: (step: ApprovalStepType) => void;
  onReject?: (step: ApprovalStepType) => void;
  busyId?: string | null;
}) {
  return (
    <div className="approval-stepper">
      {steps.map((step, index) => (
        <div key={step.id} className="approval-step">
          <div className="approval-step__rail">
            <span className="approval-step__index">{index + 1}</span>
          </div>
          <div className="approval-step__body">
            <div className="approval-step__title">
              <strong>{step.label}</strong>
              <StatusBadge status={step.status} />
            </div>
            <p>{step.owner}</p>
            {step.timestamp ? <span className="approval-step__time">{step.timestamp}</span> : null}
            {(step.status === "Pending" || step.status === "Submitted") && (onApprove || onReject) ? (
              <div className="table-row-actions">
                {onApprove ? (
                  <button className="ghost-button small" type="button" disabled={busyId !== null} onClick={() => onApprove(step)}>
                    {busyId === step.id ? "Updating..." : "Approve"}
                  </button>
                ) : null}
                {onReject ? (
                  <button className="ghost-button small" type="button" disabled={busyId !== null} onClick={() => onReject(step)}>
                    Reject
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
