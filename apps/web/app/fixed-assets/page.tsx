"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { createFixedAsset, getFixedAssetCategories, getFixedAssets, runDepreciation, type FixedAssetCategoryRecord, type FixedAssetRecord } from "../../lib/api";
import type { KpiMetric } from "../../lib/erp";

function currency(amount: string | number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(amount ?? 0));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function FixedAssetsPage() {
  const { session, activeBranch } = useWorkspace();
  const [categories, setCategories] = useState<FixedAssetCategoryRecord[]>([]);
  const [assets, setAssets] = useState<FixedAssetRecord[]>([]);
  const [message, setMessage] = useState("Track asset intake, asset register, and depreciation schedules together.");
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    tag: "",
    categoryId: 0,
    acquisitionCost: "",
    residualValue: "0",
    acquisitionDate: new Date().toISOString().slice(0, 10),
  });

  async function loadData(token: string) {
    const [categoryRows, assetRows] = await Promise.all([getFixedAssetCategories(token), getFixedAssets(token)]);
    setCategories(categoryRows);
    setAssets(assetRows);
    if (!draft.categoryId && categoryRows[0]) {
      setDraft((current) => ({ ...current, categoryId: categoryRows[0].id }));
    }
  }

  useEffect(() => {
    if (!session?.token) return;
    loadData(session.token).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load fixed assets."));
  }, [session?.token]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const depreciationLines = assets.flatMap((asset) => asset.depreciationLines);
    const depreciationValue = depreciationLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
    return [
      { label: "Asset register", value: String(assets.length), delta: `${categories.length} categories`, trend: assets.length ? "up" : "neutral", detail: "Fixed assets currently tracked" },
      { label: "Depreciation lines", value: String(depreciationLines.length), delta: currency(depreciationValue), trend: depreciationLines.length ? "up" : "neutral", detail: "Posted depreciation schedule lines" },
      { label: "Active branch", value: activeBranch?.name ?? "All branches", delta: "Context", trend: "neutral", detail: "Branch used for asset posting context" },
      { label: "Assets with schedules", value: String(assets.filter((asset) => asset.depreciationLines.length > 0).length), delta: "Schedule coverage", trend: "up", detail: "Assets already carrying depreciation history" },
    ];
  }, [activeBranch?.name, assets, categories.length]);

  const assetRows = assets.map((asset) => ({
    id: String(asset.id),
    tag: asset.tag,
    name: asset.name,
    category: asset.category.name,
    cost: Number(asset.acquisitionCost),
    acquiredOn: shortDate(asset.acquisitionDate),
    rawAcquiredOn: asset.acquisitionDate,
    status: asset.status === "ACTIVE" ? "Approved" : "Draft",
  }));

  const depreciationRows = assets.flatMap((asset) =>
    asset.depreciationLines.map((line) => ({
      id: `${asset.id}-${line.id}`,
      asset: `${asset.tag} - ${asset.name}`,
      period: `${shortDate(line.periodStart)} to ${shortDate(line.periodEnd)}`,
      rawPeriodStart: line.periodStart,
      rawPeriodEnd: line.periodEnd,
      amount: Number(line.amount),
      accumulated: Number(line.accumulated),
      method: asset.category.depreciationMethod,
      lifeMonths: asset.category.usefulLifeMonths,
    })),
  );

  async function addAsset() {
    if (!session?.token || !draft.name.trim() || !draft.tag.trim() || !draft.categoryId || !draft.acquisitionCost.trim()) {
      setMessage("Enter asset name, tag, category, and acquisition cost before saving.");
      return;
    }

    try {
      await createFixedAsset(session.token, {
        name: draft.name.trim(),
        tag: draft.tag.trim(),
        categoryId: draft.categoryId,
        branchId: activeBranch?.id,
        acquisitionDate: draft.acquisitionDate,
        acquisitionCost: Number(draft.acquisitionCost),
        residualValue: Number(draft.residualValue || 0),
      });
      await loadData(session.token);
      setDraft({
        name: "",
        tag: "",
        categoryId: categories[0]?.id ?? 0,
        acquisitionCost: "",
        residualValue: "0",
        acquisitionDate: new Date().toISOString().slice(0, 10),
      });
      setMessage("Asset added to the register.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create asset.");
    }
  }

  async function runSchedule() {
    if (!session?.token) return;
    setRunning(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await runDepreciation(session.token, {
        periodStart: today.slice(0, 8) + "01",
        periodEnd: today,
      });
      await loadData(session.token);
      setMessage("Depreciation run posted and the schedule refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not run depreciation.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <WorkspaceShell
      title="Fixed Assets"
      description="Track asset intake, asset register, and depreciation schedule sub-modules in one controlled workspace."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      tabs={["Dashboard", "Asset Register", "Depreciation Schedule", "Disposals", "Controls"]}
      activeTab="Asset Register"
      pageActions={
        <ModuleActionBar
          primaryAction={<button className="primary-button" type="button" onClick={addAsset}>Add asset</button>}
          summary="Asset intake stays visible. Depreciation runs, schedule review, and register access are grouped into menus above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: running ? "Running depreciation..." : "Run depreciation",
                  description: "Generate schedule lines for the current period",
                  onSelect: () => void runSchedule(),
                  disabled: running,
                },
                {
                  label: "Asset intake desk",
                  description: "Jump to new asset registration",
                  onSelect: () => document.getElementById("fixed-assets-intake")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                {
                  label: "Depreciation schedule",
                  description: "Open the schedule sub-module below",
                  onSelect: () => document.getElementById("fixed-assets-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Asset register",
                  description: "Jump to the current asset master",
                  onSelect: () => document.getElementById("fixed-assets-register")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="assets" />)}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Asset intake desk" eyebrow="Register new fixed assets">
          <div className="action-form-stack" id="fixed-assets-intake">
            <div className="form-grid two-up">
              <label className="field">
                <span>Asset name</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Packaging line motor" />
              </label>
              <label className="field">
                <span>Asset tag</span>
                <input value={draft.tag} onChange={(event) => setDraft((current) => ({ ...current, tag: event.target.value }))} placeholder="AST-001" />
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Category</span>
                <select className="select-input" value={draft.categoryId} onChange={(event) => setDraft((current) => ({ ...current, categoryId: Number(event.target.value) }))}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.usefulLifeMonths} months)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Acquisition date</span>
                <input type="date" value={draft.acquisitionDate} onChange={(event) => setDraft((current) => ({ ...current, acquisitionDate: event.target.value }))} />
              </label>
            </div>
            <div className="form-grid two-up">
              <label className="field">
                <span>Acquisition cost</span>
                <input value={draft.acquisitionCost} onChange={(event) => setDraft((current) => ({ ...current, acquisitionCost: event.target.value }))} placeholder="4800000" />
              </label>
              <label className="field">
                <span>Residual value</span>
                <input value={draft.residualValue} onChange={(event) => setDraft((current) => ({ ...current, residualValue: event.target.value }))} placeholder="0" />
              </label>
            </div>
            <p className="note">{message}</p>
          </div>
        </SectionCard>

        <SectionCard title="Depreciation schedule sub-module" eyebrow="Asset-by-asset schedule visibility">
          <div id="fixed-assets-schedule" />
          {depreciationRows.length === 0 ? (
            <EmptyState tone="finance" title="No depreciation schedule yet" body="Run depreciation after assets are registered to populate schedule lines here." />
          ) : (
            <DataTable
              title="Depreciation schedule"
              tableId="asset-depreciation-schedule"
              exportFileName="asset-depreciation-schedule"
              rows={depreciationRows}
              searchValue={(row) => `${row.asset} ${row.method}`}
              filters={[
                { key: "straight", label: "Straight line", predicate: (row) => row.method === "STRAIGHT_LINE" },
              ]}
              advancedFilters={[
                { key: "asset", label: "Asset", type: "text", getValue: (row) => row.asset },
                {
                  key: "method",
                  label: "Method",
                  type: "select",
                  getValue: (row) => row.method,
                  options: [{ value: "STRAIGHT_LINE", label: "Straight line" }],
                },
                { key: "periodStart", label: "Period start", type: "date-range", getValue: (row) => row.rawPeriodStart },
                { key: "amount", label: "Depreciation amount", type: "number-range", getValue: (row) => row.amount },
              ]}
              bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
              columns={[
                { key: "asset", label: "Asset", render: (row) => <strong>{row.asset}</strong>, exportValue: (row) => row.asset },
                { key: "period", label: "Period", render: (row) => row.period, exportValue: (row) => row.period },
                { key: "amount", label: "Depreciation", className: "numeric", render: (row) => currency(row.amount), exportValue: (row) => row.amount },
                { key: "accumulated", label: "Accumulated", className: "numeric", render: (row) => currency(row.accumulated), exportValue: (row) => row.accumulated },
                { key: "lifeMonths", label: "Life (months)", className: "numeric", render: (row) => row.lifeMonths, exportValue: (row) => row.lifeMonths },
              ]}
            />
          )}
        </SectionCard>
      </section>

      <SectionCard title="Asset register" eyebrow="Current asset master">
        <div id="fixed-assets-register" />
        <DataTable
          title="Assets"
          tableId="asset-register"
          exportFileName="asset-register"
          rows={assetRows}
          searchValue={(row) => `${row.tag} ${row.name} ${row.category}`}
          filters={[
            { key: "registered", label: "Registered", predicate: (row) => row.status === "Approved" },
          ]}
          advancedFilters={[
            { key: "assetTag", label: "Asset tag", type: "text", getValue: (row) => row.tag },
            { key: "assetName", label: "Asset name", type: "text", getValue: (row) => row.name },
            { key: "category", label: "Category", type: "text", getValue: (row) => row.category },
            { key: "acquiredOn", label: "Acquired on", type: "date-range", getValue: (row) => row.rawAcquiredOn },
            { key: "cost", label: "Cost", type: "number-range", getValue: (row) => row.cost },
          ]}
          bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
          emptyTitle="No assets yet"
          emptyMessage="Add an asset from the intake desk to populate this register."
          columns={[
            { key: "tag", label: "Asset", render: (row) => <strong>{row.tag}</strong>, exportValue: (row) => row.tag },
            { key: "name", label: "Name", render: (row) => row.name, exportValue: (row) => row.name },
            { key: "category", label: "Category", render: (row) => row.category, exportValue: (row) => row.category },
            { key: "cost", label: "Cost", className: "numeric", render: (row) => currency(row.cost), exportValue: (row) => row.cost },
            { key: "acquiredOn", label: "Acquired", render: (row) => row.acquiredOn, exportValue: (row) => row.acquiredOn },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status as "Approved" | "Draft"} />, exportValue: (row) => row.status },
          ]}
        />
      </SectionCard>
    </WorkspaceShell>
  );
}
