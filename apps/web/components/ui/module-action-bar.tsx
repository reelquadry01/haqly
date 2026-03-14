"use client";

import type { ReactNode } from "react";
import { ActionMenu, type ActionMenuItem } from "./action-menu";

export type ActionMenuGroup = {
  label: string;
  items: ActionMenuItem[];
  tone?: "ghost" | "primary";
};

export function ModuleActionBar({
  primaryAction,
  primaryLabel,
  onPrimaryAction,
  secondaryGroups = [],
  summary,
}: {
  primaryAction?: ReactNode;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  secondaryGroups?: ActionMenuGroup[];
  summary?: string;
}) {
  return (
    <div className="module-action-bar surface">
      <div className="module-action-bar__main">
        {primaryAction ? primaryAction : primaryLabel && onPrimaryAction ? (
          <button type="button" className="primary-button" onClick={onPrimaryAction}>
            {primaryLabel}
          </button>
        ) : null}

        <div className="module-action-bar__menus">
          {secondaryGroups.map((group) => (
            <ActionMenu key={group.label} label={group.label} items={group.items} tone={group.tone ?? "ghost"} />
          ))}
        </div>
      </div>

      {summary ? <p className="module-action-bar__summary">{summary}</p> : null}
    </div>
  );
}
