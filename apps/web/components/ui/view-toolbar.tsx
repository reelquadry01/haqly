"use client";

import type { ReactNode } from "react";

export function ViewToolbar({
  left,
  right,
  chips,
}: {
  left?: ReactNode;
  right?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <div className="view-toolbar surface-muted">
      <div className="view-toolbar__row">
        <div className="view-toolbar__left">{left}</div>
        <div className="view-toolbar__right">{right}</div>
      </div>
      {chips ? <div className="view-toolbar__chips">{chips}</div> : null}
    </div>
  );
}
