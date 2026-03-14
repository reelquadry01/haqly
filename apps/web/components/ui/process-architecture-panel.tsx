"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed, Link2 } from "lucide-react";
import {
  type WorkflowBlueprint,
  type WorkflowChecklistItem,
} from "../../lib/process-flows";

type WorkflowAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

type WorkflowChecklistActionMap = Record<string, WorkflowAction | undefined>;

type WorkflowNextAction = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  onSelect?: () => void;
};

function ChecklistIcon({ item }: { item: WorkflowChecklistItem }) {
  if (item.status === "ready") {
    return <CheckCircle2 size={16} />;
  }
  if (item.status === "attention") {
    return <AlertCircle size={16} />;
  }
  return <CircleDashed size={16} />;
}

export function ProcessArchitecturePanel({
  blueprint,
  checklistActions,
  nextActions,
}: {
  blueprint: WorkflowBlueprint;
  checklistActions?: WorkflowChecklistActionMap;
  nextActions?: WorkflowNextAction[];
}) {
  return (
    <section className="process-architecture surface">
      <div className="process-architecture__header">
        <div>
          <span className="section-eyebrow">Connected process</span>
          <h2>{blueprint.title}</h2>
          <p>{blueprint.summary}</p>
        </div>
      </div>

      <div className="process-architecture__grid">
        <div className="process-architecture__section">
          <div className="process-architecture__section-head">
            <strong>Prerequisites</strong>
            <span>What must exist first</span>
          </div>
          <div className="process-checklist">
            {blueprint.checklist.map((item) => {
              const action = checklistActions?.[item.id];
              return (
                <article key={item.id} className={`process-checklist__item is-${item.status}`}>
                  <div className="process-checklist__icon">
                    <ChecklistIcon item={item} />
                  </div>
                  <div className="process-checklist__content">
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {action ? (
                    action.href ? (
                      <Link className="table-tag process-link" href={action.href}>
                        {action.label}
                      </Link>
                    ) : (
                      <button className="table-tag process-link" type="button" onClick={action.onSelect}>
                        {action.label}
                      </button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        <div className="process-architecture__section">
          <div className="process-architecture__section-head">
            <strong>Business flow</strong>
            <span>How data moves next</span>
          </div>
          <div className="process-flow-strip">
            {blueprint.stages.map((stage, index) => (
              <article key={stage.id} className={`process-flow-step is-${stage.status}`}>
                <div className="process-flow-step__marker">{index + 1}</div>
                <div className="process-flow-step__copy">
                  <strong>{stage.label}</strong>
                  <p>{stage.detail}</p>
                </div>
                {index < blueprint.stages.length - 1 ? <ArrowRight size={16} className="process-flow-step__arrow" /> : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="process-architecture__grid process-architecture__grid--bottom">
        <div className="process-architecture__section">
          <div className="process-architecture__section-head">
            <strong>Related records</strong>
            <span>Shared master data and downstream documents</span>
          </div>
          <div className="process-related-grid">
            {blueprint.relatedRecords.map((record) => (
              <article key={record.id} className="process-related-card">
                <span>{record.label}</span>
                <strong>{record.value}</strong>
                <p>{record.detail}</p>
              </article>
            ))}
          </div>
        </div>

        {nextActions?.length ? (
          <div className="process-architecture__section">
            <div className="process-architecture__section-head">
              <strong>Guided next actions</strong>
              <span>Fast paths into the correct downstream step</span>
            </div>
            <div className="process-next-actions">
              {nextActions.map((action) =>
                action.href ? (
                  <Link key={action.id} href={action.href} className="process-next-actions__item">
                    <div>
                      <strong>{action.label}</strong>
                      <p>{action.detail}</p>
                    </div>
                    <Link2 size={16} />
                  </Link>
                ) : (
                  <button key={action.id} type="button" className="process-next-actions__item" onClick={action.onSelect}>
                    <div>
                      <strong>{action.label}</strong>
                      <p>{action.detail}</p>
                    </div>
                    <Link2 size={16} />
                  </button>
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>

      {blueprint.assumptionNote ? (
        <div className="process-assumption-note">
          <strong>Current workflow note</strong>
          <p>{blueprint.assumptionNote}</p>
        </div>
      ) : null}
    </section>
  );
}
