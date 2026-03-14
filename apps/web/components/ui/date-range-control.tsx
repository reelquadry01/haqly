"use client";

import { CalendarRange, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import {
  defaultDateSelection,
  ErpDateSelection,
  ErpPeriodPreset,
  labelForPreset,
  resolvePresetRange,
} from "../../lib/date-range";

const presetOptions: Array<{ value: ErpPeriodPreset; label: string }> = [
  { value: "month_to_date", label: "Month to Date" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter_to_date", label: "Quarter to Date" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "year_to_date", label: "Year to Date" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom_range", label: "Custom Range" },
];

export function DateRangeControl({
  title = "Reporting window",
  value,
  onApply,
  applyLabel = "Apply",
}: {
  title?: string;
  value?: ErpDateSelection;
  onApply: (selection: ErpDateSelection) => void;
  applyLabel?: string;
}) {
  const [draft, setDraft] = useState<ErpDateSelection>(value ?? defaultDateSelection());

  useEffect(() => {
    if (value) {
      setDraft(value);
    }
  }, [value]);

  function setPreset(nextPreset: ErpPeriodPreset) {
    if (nextPreset === "custom_range") {
      setDraft((current) => ({
        ...current,
        mode: "range",
        preset: nextPreset,
        label: labelForPreset(nextPreset),
      }));
      return;
    }

    const resolved = resolvePresetRange(nextPreset);
    setDraft({
      mode: "period",
      preset: nextPreset,
      ...resolved,
    });
  }

  return (
    <div className="date-range-control surface-muted">
      <div className="date-range-control__head">
        <div>
          <span className="section-eyebrow">ERP filter</span>
          <strong>{title}</strong>
        </div>
        <div className="date-range-control__summary">
          <CalendarRange size={16} />
          <span>{draft.label}</span>
          <small>
            {draft.from} to {draft.to}
          </small>
        </div>
      </div>

      <div className="date-range-control__body">
        <div className="segmented-toggle">
          <button
            type="button"
            className={draft.mode === "period" ? "segmented-toggle__item active" : "segmented-toggle__item"}
            onClick={() => setDraft((current) => ({ ...current, mode: "period", preset: current.preset === "custom_range" ? "month_to_date" : current.preset }))}
          >
            Period Range
          </button>
          <button
            type="button"
            className={draft.mode === "range" ? "segmented-toggle__item active" : "segmented-toggle__item"}
            onClick={() => setDraft((current) => ({ ...current, mode: "range", preset: "custom_range", label: "Custom Range" }))}
          >
            Date Range
          </button>
        </div>

        {draft.mode === "period" ? (
          <label className="field">
            <span>Accounting period preset</span>
            <select
              className="select-input"
              value={draft.preset}
              onChange={(event) => setPreset(event.target.value as ErpPeriodPreset)}
            >
              {presetOptions.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="form-grid two-up">
          <label className="field">
            <span>From date</span>
            <input
              type="date"
              value={draft.from}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  mode: "range",
                  preset: "custom_range",
                  label: "Custom Range",
                  from: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>To date</span>
            <input
              type="date"
              value={draft.to}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  mode: "range",
                  preset: "custom_range",
                  label: "Custom Range",
                  to: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </div>

      <div className="inline-actions compact-end">
        <button className="primary-button with-icon" type="button" onClick={() => onApply(draft)}>
          <Filter size={16} />
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
