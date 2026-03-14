"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type ActionMenuItem = {
  label: string;
  description?: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export function ActionMenu({
  label,
  items,
  tone = "ghost",
  align = "left",
  triggerVariant = "label",
  triggerIcon,
  srLabel,
}: {
  label: string;
  items: ActionMenuItem[];
  tone?: "ghost" | "primary";
  align?: "left" | "right";
  triggerVariant?: "label" | "icon";
  triggerIcon?: ReactNode;
  srLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const panelId = useId();

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="dropdown-wrap">
      <button
        id={buttonId}
        type="button"
        className={
          triggerVariant === "icon"
            ? tone === "primary"
              ? "primary-button icon-only"
              : "ghost-button icon-only"
            : tone === "primary"
              ? "primary-button with-icon"
              : "ghost-button with-icon"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={triggerVariant === "icon" ? srLabel ?? label : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {triggerVariant === "icon" ? (
          triggerIcon ?? <ChevronDown size={16} />
        ) : (
          <>
            {label}
            <ChevronDown size={16} />
          </>
        )}
      </button>

      {open ? (
        <div id={panelId} role="menu" aria-labelledby={buttonId} className={`floating-menu floating-menu--action ${align === "right" ? "floating-menu--right" : ""}`}>
          {items.map((item) =>
            item.href ? (
              <Link
                key={`${label}-${item.label}`}
                href={item.href}
                role="menuitem"
                className={`floating-menu__item floating-menu__item--link ${item.disabled ? "is-disabled" : ""}`}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  setOpen(false);
                }}
              >
                <div>
                  <strong>{item.label}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                </div>
              </Link>
            ) : (
              <button
                key={`${label}-${item.label}`}
                type="button"
                role="menuitem"
                className="floating-menu__item"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                <div>
                  <strong>{item.label}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                </div>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
