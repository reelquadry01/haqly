"use client";

import type { ReactNode } from "react";

export function DataGridToolbar({
  title,
  count,
  commandArea,
  viewControls,
}: {
  title?: string;
  count: number;
  commandArea?: ReactNode;
  viewControls?: ReactNode;
}) {
  return (
    <div className="data-grid-toolbar">
      <div className="table-toolbar">
        <div className="table-toolbar__title">
          {title ? <h3>{title}</h3> : null}
          <p>{count} records</p>
        </div>
        {commandArea ? <div className="table-toolbar__commands">{commandArea}</div> : null}
      </div>
      {viewControls ? <div className="data-grid-toolbar__view">{viewControls}</div> : null}
    </div>
  );
}
