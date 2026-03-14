export type ErpRangeMode = "period" | "range";

export type ErpPeriodPreset =
  | "month_to_date"
  | "this_month"
  | "last_month"
  | "quarter_to_date"
  | "this_quarter"
  | "last_quarter"
  | "year_to_date"
  | "this_year"
  | "last_year"
  | "custom_range";

export type ErpDateSelection = {
  mode: ErpRangeMode;
  preset: ErpPeriodPreset;
  from: string;
  to: string;
  label: string;
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function startOfQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

function endOfQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth + 3, 0));
}

function startOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function endOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
}

export function labelForPreset(preset: ErpPeriodPreset) {
  switch (preset) {
    case "month_to_date":
      return "Month to Date";
    case "this_month":
      return "This Month";
    case "last_month":
      return "Last Month";
    case "quarter_to_date":
      return "Quarter to Date";
    case "this_quarter":
      return "This Quarter";
    case "last_quarter":
      return "Last Quarter";
    case "year_to_date":
      return "Year to Date";
    case "this_year":
      return "This Year";
    case "last_year":
      return "Last Year";
    case "custom_range":
      return "Custom Range";
  }
}

export function resolvePresetRange(
  preset: ErpPeriodPreset,
  anchor = new Date(),
): Pick<ErpDateSelection, "from" | "to" | "label"> {
  const today = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));

  switch (preset) {
    case "month_to_date":
      return {
        from: toIsoDate(startOfMonth(today)),
        to: toIsoDate(today),
        label: "Month to Date",
      };
    case "this_month":
      return {
        from: toIsoDate(startOfMonth(today)),
        to: toIsoDate(endOfMonth(today)),
        label: "This Month",
      };
    case "last_month": {
      const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      return {
        from: toIsoDate(startOfMonth(lastMonth)),
        to: toIsoDate(endOfMonth(lastMonth)),
        label: "Last Month",
      };
    }
    case "quarter_to_date":
      return {
        from: toIsoDate(startOfQuarter(today)),
        to: toIsoDate(today),
        label: "Quarter to Date",
      };
    case "this_quarter":
      return {
        from: toIsoDate(startOfQuarter(today)),
        to: toIsoDate(endOfQuarter(today)),
        label: "This Quarter",
      };
    case "last_quarter": {
      const lastQuarterAnchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
      return {
        from: toIsoDate(startOfQuarter(lastQuarterAnchor)),
        to: toIsoDate(endOfQuarter(lastQuarterAnchor)),
        label: "Last Quarter",
      };
    }
    case "year_to_date":
      return {
        from: toIsoDate(startOfYear(today)),
        to: toIsoDate(today),
        label: "Year to Date",
      };
    case "this_year":
      return {
        from: toIsoDate(startOfYear(today)),
        to: toIsoDate(endOfYear(today)),
        label: "This Year",
      };
    case "last_year": {
      const lastYear = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
      return {
        from: toIsoDate(startOfYear(lastYear)),
        to: toIsoDate(endOfYear(lastYear)),
        label: "Last Year",
      };
    }
    case "custom_range":
      return {
        from: toIsoDate(startOfMonth(today)),
        to: toIsoDate(today),
        label: "Custom Range",
      };
  }
}

export function defaultDateSelection(anchor = new Date()): ErpDateSelection {
  const resolved = resolvePresetRange("month_to_date", anchor);
  return {
    mode: "period",
    preset: "month_to_date",
    ...resolved,
  };
}
