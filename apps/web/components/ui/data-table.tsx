"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileSpreadsheet, FileText, Maximize2, Minimize2 } from "lucide-react";
import { EmptyState } from "./empty-state";
import { BulkActionToolbar } from "./bulk-action-toolbar";
import { DataGridToolbar } from "./data-grid-toolbar";
import { downloadCsvFile, downloadExcelFile, downloadPdfFile } from "../../lib/export";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  className?: string;
  sticky?: "left" | "right";
  render: (row: T) => React.ReactNode;
  exportValue?: (row: T) => unknown;
};

export type DataTableFilter<T> = {
  key: string;
  label: string;
  predicate: (row: T) => boolean;
};

export type DataTableAdvancedFilter<T> =
  | {
      key: string;
      label: string;
      type: "text";
      placeholder?: string;
      getValue: (row: T) => string | null | undefined;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: Array<{ label: string; value: string }>;
      getValue: (row: T) => string | null | undefined;
    }
  | {
      key: string;
      label: string;
      type: "number-range";
      minPlaceholder?: string;
      maxPlaceholder?: string;
      getValue: (row: T) => number | null | undefined;
    }
  | {
      key: string;
      label: string;
      type: "date-range";
      getValue: (row: T) => string | Date | null | undefined;
    };

export function DataTable<T extends { id: string }>({
  title,
  rows,
  columns,
  searchPlaceholder = "Search records",
  searchValue,
  filters = [],
  emptyTitle = "Nothing to show yet",
  emptyMessage = "Records will appear here once data is available.",
  bulkActions,
  advancedFilters = [],
  tableId,
  exportFileName,
  onBulkAction,
}: {
  title?: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  filters?: DataTableFilter<T>[];
  emptyTitle?: string;
  emptyMessage?: string;
  bulkActions?: string[];
  advancedFilters?: DataTableAdvancedFilter<T>[];
  tableId?: string;
  exportFileName?: string;
  onBulkAction?: (action: string, rows: T[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [advancedFilterValues, setAdvancedFilterValues] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const storageKey = tableId ? `haqly.table.${tableId}` : "";
  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumns.includes(column.key)),
    [columns, hiddenColumns],
  );

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const filterMatch = activeFilter === "all" || filters.find((item) => item.key === activeFilter)?.predicate(row);
      const haystack = searchValue ? searchValue(row).toLowerCase() : JSON.stringify(row).toLowerCase();
      const queryMatch = haystack.includes(query.toLowerCase());
      const advancedMatch = advancedFilters.every((filter) => {
        if (filter.type === "text") {
          const currentValue = (advancedFilterValues[filter.key] ?? "").trim().toLowerCase();
          if (!currentValue) {
            return true;
          }
          return String(filter.getValue(row) ?? "").toLowerCase().includes(currentValue);
        }

        if (filter.type === "select") {
          const selected = advancedFilterValues[filter.key] ?? "";
          if (!selected) {
            return true;
          }
          return String(filter.getValue(row) ?? "") === selected;
        }

        if (filter.type === "number-range") {
          const rawValue = filter.getValue(row);
          const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
          const min = advancedFilterValues[`${filter.key}__min`];
          const max = advancedFilterValues[`${filter.key}__max`];
          if (min && numericValue < Number(min)) {
            return false;
          }
          if (max && numericValue > Number(max)) {
            return false;
          }
          return true;
        }

        const rawValue = filter.getValue(row);
        if (!rawValue) {
          return !(advancedFilterValues[`${filter.key}__from`] || advancedFilterValues[`${filter.key}__to`]);
        }
        const currentDate = new Date(rawValue).getTime();
        const from = advancedFilterValues[`${filter.key}__from`];
        const to = advancedFilterValues[`${filter.key}__to`];
        if (from && currentDate < new Date(from).getTime()) {
          return false;
        }
        if (to && currentDate > new Date(to).getTime()) {
          return false;
        }
        return true;
      });
      return Boolean(filterMatch) && queryMatch && advancedMatch;
    });
  }, [activeFilter, advancedFilterValues, advancedFilters, filters, query, rows, searchValue]);

  const activeAdvancedFilterCount = useMemo(
    () => Object.values(advancedFilterValues).filter((value) => Boolean(String(value ?? "").trim())).length,
    [advancedFilterValues],
  );

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const selectedRows = visibleRows.filter((row) => selectedIds.includes(row.id));

  useEffect(() => {
    if (!maximized) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMaximized(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximized]);

  function getStickyClass(column: DataTableColumn<T>) {
    const sticky = column.sticky ?? (column.key === "actions" ? "right" : undefined);
    if (!sticky) {
      return "";
    }
    return sticky === "right" ? "table-cell--sticky-right" : "table-cell--sticky-left";
  }

  function getColumnClass(column: DataTableColumn<T>) {
    return [column.className, getStickyClass(column), column.key === "actions" ? "table-cell--actions" : ""]
      .filter(Boolean)
      .join(" ");
  }

  function getExportValue(row: T, column: DataTableColumn<T>) {
    if (column.exportValue) {
      return column.exportValue(row);
    }

    const rendered = column.render(row);
    if (typeof rendered === "string" || typeof rendered === "number" || typeof rendered === "boolean") {
      return rendered;
    }

    const rawValue = row[column.key as keyof T];
    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      return rawValue ?? "";
    }

    return "";
  }

  function exportRows(format: "csv" | "xlsx" | "pdf", nextRows: T[], scope: "visible" | "selected" = "visible") {
    const filenameBase = exportFileName ?? (title ? title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") : "records");
    const headers = visibleColumns.map((column) => column.label);
    const bodyRows = nextRows.map((row) => visibleColumns.map((column) => getExportValue(row, column)));
    const filename = `${filenameBase}-${scope}.${format === "xlsx" ? "xlsx" : format}`;
    const exportTitle = title ?? "Records";

    if (format === "csv") {
      downloadCsvFile(filename, headers, bodyRows);
    } else if (format === "xlsx") {
      downloadExcelFile(filename, headers, bodyRows, exportTitle);
    } else {
      downloadPdfFile(filename, exportTitle, headers, bodyRows);
    }

    setStatusMessage(
      `Exported ${nextRows.length} ${scope} row${nextRows.length === 1 ? "" : "s"} to ${format === "xlsx" ? "Excel" : format.toUpperCase()}.`,
    );
    setExportOpen(false);
  }

  function saveCurrentView() {
    if (!storageKey) {
      setStatusMessage("This table does not have saved views configured yet.");
      return;
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        query,
        activeFilter,
        hiddenColumns,
        advancedFilterValues,
      }),
    );
    setStatusMessage("Saved current search, filter, and column layout.");
    setSavedViewsOpen(false);
  }

  function loadSavedView() {
    if (!storageKey) {
      setStatusMessage("This table does not have saved views configured yet.");
      return;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setStatusMessage("No saved view found for this table yet.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { query?: string; activeFilter?: string; hiddenColumns?: string[]; advancedFilterValues?: Record<string, string> };
      setQuery(parsed.query ?? "");
      setActiveFilter(parsed.activeFilter ?? "all");
      setHiddenColumns(parsed.hiddenColumns ?? []);
      setAdvancedFilterValues(parsed.advancedFilterValues ?? {});
      setStatusMessage("Loaded your saved table view.");
      setSavedViewsOpen(false);
    } catch {
      setStatusMessage("Saved view could not be read. It may need to be saved again.");
    }
  }

  function clearSavedView() {
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
    setStatusMessage("Cleared the saved view for this table.");
    setSavedViewsOpen(false);
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleRows.map((row) => row.id));
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function toggleColumn(columnKey: string) {
    setHiddenColumns((current) =>
      current.includes(columnKey) ? current.filter((entry) => entry !== columnKey) : [...current, columnKey],
    );
  }

  function updateAdvancedFilter(key: string, value: string) {
    setAdvancedFilterValues((current) => ({ ...current, [key]: value }));
  }

  function clearAdvancedFilters() {
    setAdvancedFilterValues({});
    setStatusMessage("Cleared advanced table filters.");
  }

  function handleBulkAction(action: string) {
    if (selectedRows.length === 0) {
      return;
    }
    const isExportAction = action.toLowerCase().includes("export");
    if (isExportAction) {
      const actionLabel = action.toLowerCase();
      if (actionLabel.includes("excel")) {
        exportRows("xlsx", selectedRows, "selected");
        return;
      }
      if (actionLabel.includes("pdf")) {
        exportRows("pdf", selectedRows, "selected");
        return;
      }
      exportRows("csv", selectedRows, "selected");
      return;
    }
    if (onBulkAction) {
      onBulkAction(action, selectedRows);
      setStatusMessage(`Applied "${action}" to ${selectedRows.length} selected row${selectedRows.length === 1 ? "" : "s"}.`);
      return;
    }
    setStatusMessage(`"${action}" is acknowledged for ${selectedRows.length} selected row${selectedRows.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className={`table-shell${collapsed ? " is-collapsed" : ""}${maximized ? " is-maximized" : ""}`}>
      <DataGridToolbar
        title={title}
        count={visibleRows.length}
        commandArea={
          <div className="table-shell__controls">
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setCollapsed((current) => !current)}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {collapsed ? "Expand" : "Collapse"}
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setMaximized((current) => !current)}
              aria-pressed={maximized}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {maximized ? "Minimize" : "Maximize"}
            </button>
          </div>
        }
        viewControls={
          <div className="table-toolbar__actions">
            <input
              className="table-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
            <div className="table-toolbar__tools">
              <div className="dropdown-wrap">
                {advancedFilters.length > 0 ? (
                  <>
                    <button type="button" className="ghost-button" onClick={() => setAdvancedFiltersOpen((current) => !current)}>
                      Filters{activeAdvancedFilterCount ? ` (${activeAdvancedFilterCount})` : ""}
                    </button>
                    {advancedFiltersOpen ? (
                      <div className="floating-menu floating-menu--table floating-menu--filters">
                        <div className="floating-menu__filter-head">
                          <strong>Advanced filters</strong>
                          <button type="button" className="ghost-button small" onClick={clearAdvancedFilters}>
                            Clear
                          </button>
                        </div>
                        <div className="advanced-filter-grid">
                          {advancedFilters.map((filter) => {
                            if (filter.type === "text") {
                              return (
                                <label key={filter.key} className="field advanced-filter-field">
                                  <span>{filter.label}</span>
                                  <input
                                    className="table-search"
                                    value={advancedFilterValues[filter.key] ?? ""}
                                    onChange={(event) => updateAdvancedFilter(filter.key, event.target.value)}
                                    placeholder={filter.placeholder ?? `Filter by ${filter.label.toLowerCase()}`}
                                  />
                                </label>
                              );
                            }

                            if (filter.type === "select") {
                              return (
                                <label key={filter.key} className="field advanced-filter-field">
                                  <span>{filter.label}</span>
                                  <select
                                    className="select-input"
                                    value={advancedFilterValues[filter.key] ?? ""}
                                    onChange={(event) => updateAdvancedFilter(filter.key, event.target.value)}
                                  >
                                    <option value="">All</option>
                                    {filter.options.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            }

                            if (filter.type === "number-range") {
                              return (
                                <div key={filter.key} className="advanced-filter-field">
                                  <span>{filter.label}</span>
                                  <div className="advanced-filter-range">
                                    <input
                                      className="table-search"
                                      inputMode="decimal"
                                      value={advancedFilterValues[`${filter.key}__min`] ?? ""}
                                      onChange={(event) => updateAdvancedFilter(`${filter.key}__min`, event.target.value)}
                                      placeholder={filter.minPlaceholder ?? "Min"}
                                    />
                                    <input
                                      className="table-search"
                                      inputMode="decimal"
                                      value={advancedFilterValues[`${filter.key}__max`] ?? ""}
                                      onChange={(event) => updateAdvancedFilter(`${filter.key}__max`, event.target.value)}
                                      placeholder={filter.maxPlaceholder ?? "Max"}
                                    />
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={filter.key} className="advanced-filter-field">
                                <span>{filter.label}</span>
                                <div className="advanced-filter-range">
                                  <input
                                    className="table-search"
                                    type="date"
                                    value={advancedFilterValues[`${filter.key}__from`] ?? ""}
                                    onChange={(event) => updateAdvancedFilter(`${filter.key}__from`, event.target.value)}
                                  />
                                  <input
                                    className="table-search"
                                    type="date"
                                    value={advancedFilterValues[`${filter.key}__to`] ?? ""}
                                    onChange={(event) => updateAdvancedFilter(`${filter.key}__to`, event.target.value)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="dropdown-wrap">
                <button type="button" className="ghost-button" onClick={() => setSavedViewsOpen((current) => !current)}>
                  Saved views
                </button>
                {savedViewsOpen ? (
                  <div className="floating-menu floating-menu--table">
                    <button type="button" className="floating-menu__item" onClick={saveCurrentView}>
                      <div>
                        <strong>Save current view</strong>
                        <span>Search, filter, and columns</span>
                      </div>
                    </button>
                    <button type="button" className="floating-menu__item" onClick={loadSavedView}>
                      <div>
                        <strong>Load saved view</strong>
                        <span>Restore your last saved layout</span>
                      </div>
                    </button>
                    <button type="button" className="floating-menu__item" onClick={clearSavedView}>
                      <div>
                        <strong>Clear saved view</strong>
                        <span>Reset stored preferences for this table</span>
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="dropdown-wrap">
                <button type="button" className="ghost-button" onClick={() => setColumnsOpen((current) => !current)}>
                  Columns
                </button>
                {columnsOpen ? (
                  <div className="floating-menu floating-menu--table">
                    {columns.map((column) => (
                      <label key={column.key} className="floating-menu__check">
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.includes(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="dropdown-wrap">
                <button type="button" className="ghost-button with-icon" onClick={() => setExportOpen((current) => !current)}>
                  Export <ChevronDown size={16} />
                </button>
                {exportOpen ? (
                  <div className="floating-menu floating-menu--table">
                    <button type="button" className="floating-menu__item" onClick={() => exportRows("csv", visibleRows)}>
                      <FileText size={16} className="floating-menu__icon export-icon export-icon--csv" />
                      <div>
                        <strong>Export CSV</strong>
                        <span>Comma-separated file for quick sharing</span>
                      </div>
                    </button>
                    <button type="button" className="floating-menu__item" onClick={() => exportRows("xlsx", visibleRows)}>
                      <FileSpreadsheet size={16} className="floating-menu__icon export-icon export-icon--excel" />
                      <div>
                        <strong>Export Excel</strong>
                        <span>Spreadsheet-ready workbook for analysis</span>
                      </div>
                    </button>
                    <button type="button" className="floating-menu__item" onClick={() => exportRows("pdf", visibleRows)}>
                      <FileText size={16} className="floating-menu__icon export-icon export-icon--pdf" />
                      <div>
                        <strong>Export PDF</strong>
                        <span>Print-ready document with table formatting</span>
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
      />

      {statusMessage ? <p className="table-status">{statusMessage}</p> : null}

      {!collapsed && filters.length > 0 ? (
        <div className="filter-row">
          <button
            type="button"
            className={activeFilter === "all" ? "filter-chip active" : "filter-chip"}
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={activeFilter === filter.key ? "filter-chip active" : "filter-chip"}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}

      {!collapsed && selectedIds.length > 0 && bulkActions?.length ? (
        <BulkActionToolbar count={selectedIds.length} actions={bulkActions} onAction={handleBulkAction} />
      ) : null}

      {collapsed ? (
        <div className="table-shell__collapsed-note">
          <span>This table is collapsed.</span>
          <button type="button" className="ghost-button small" onClick={() => setCollapsed(false)}>
            <ChevronDown size={16} />
            Expand table
          </button>
        </div>
      ) : visibleRows.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyMessage} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="checkbox-cell table-cell--sticky-left">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
                {visibleColumns.map((column) => (
                  <th key={column.key} className={getColumnClass(column)}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className={selectedIds.includes(row.id) ? "is-selected" : undefined}>
                  <td className="checkbox-cell table-cell--sticky-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.id}`}
                    />
                  </td>
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={getColumnClass(column)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
