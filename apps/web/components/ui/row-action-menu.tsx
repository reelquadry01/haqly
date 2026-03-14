"use client";

import { MoreHorizontal } from "lucide-react";
import { ActionMenu, type ActionMenuItem } from "./action-menu";

export function RowActionMenu({
  label = "Row actions",
  items,
}: {
  label?: string;
  items: ActionMenuItem[];
}) {
  return (
    <ActionMenu
      label={label}
      items={items}
      align="right"
      triggerVariant="icon"
      triggerIcon={<MoreHorizontal size={16} />}
      srLabel={label}
    />
  );
}
