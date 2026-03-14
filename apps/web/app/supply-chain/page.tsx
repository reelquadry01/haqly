"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  getInventoryStockMovements,
  getPurchaseBills,
  type InventoryStockMovement,
  type PurchaseBillRecord,
} from "../../lib/api";
import { scmViews, type KpiMetric } from "../../lib/erp";

export default function SupplyChainPage() {
  const router = useRouter();
  const { session, activeCompany } = useWorkspace();
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBillRecord[]>([]);
  const [stockMovements, setStockMovements] = useState<InventoryStockMovement[]>([]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    Promise.all([getPurchaseBills(session.token, activeCompany?.id), getInventoryStockMovements(session.token, activeCompany?.id)])
      .then(([billRows, movementRows]) => {
        setPurchaseBills(billRows);
        setStockMovements(movementRows);
      })
      .catch(() => {
        setPurchaseBills([]);
        setStockMovements([]);
      });
  }, [activeCompany?.id, session?.token]);

  const laneRows = useMemo(() => {
    const inboundCount = stockMovements.filter((movement) => movement.direction === "IN").length;
    const outboundCount = stockMovements.filter((movement) => movement.direction === "OUT").length;
    const uniqueWarehouses = new Set(stockMovements.map((movement) => movement.warehouse?.name ?? `Warehouse ${movement.warehouseId}`)).size;
    return [
      {
        id: "lane-bills",
        lane: "Supplier billing",
        owner: "Procurement",
        volume: `${purchaseBills.length} bills`,
        risk: purchaseBills.length ? `${purchaseBills.filter((bill) => bill.status !== "PAID").length} open` : "No bills",
        status: purchaseBills.length ? "Approved" : "Pending",
      },
      {
        id: "lane-receipts",
        lane: "Inbound receipts",
        owner: "Warehouse",
        volume: `${inboundCount} receipts`,
        risk: inboundCount ? "Flow active" : "No receipts",
        status: inboundCount ? "Approved" : "Pending",
      },
      {
        id: "lane-issues",
        lane: "Outbound issues",
        owner: "Operations",
        volume: `${outboundCount} issues`,
        risk: outboundCount ? "Flow active" : "No issues",
        status: outboundCount ? "Approved" : "Pending",
      },
      {
        id: "lane-warehouses",
        lane: "Warehouse touchpoints",
        owner: "Inventory",
        volume: `${uniqueWarehouses} locations`,
        risk: uniqueWarehouses ? "Mapped from DB" : "No warehouse activity",
        status: uniqueWarehouses ? "Approved" : "Pending",
      },
    ];
  }, [purchaseBills, stockMovements]);

  const metrics: KpiMetric[] = [
    { label: "Supply lanes", value: String(laneRows.length), delta: "Derived from live records", trend: laneRows.length ? "up" : "neutral", detail: "Connected process checkpoints generated from procurement and inventory data" },
    { label: "Vendor bills", value: String(purchaseBills.length), delta: "Live procurement records", trend: purchaseBills.length ? "up" : "neutral", detail: "Purchasing activity affecting inbound supply" },
    { label: "Stock movements", value: String(stockMovements.length), delta: "Live warehouse activity", trend: stockMovements.length ? "up" : "neutral", detail: "Recent stock movements affecting fulfillment" },
    { label: "Exceptions", value: String(laneRows.filter((item) => item.status !== "Approved").length), delta: "Needs intervention", trend: laneRows.some((item) => item.status !== "Approved") ? "down" : "up", detail: "Derived lanes that still need attention" },
  ];

  const billRows = useMemo(
    () =>
      purchaseBills.map((bill) => ({
        id: String(bill.id),
        number: bill.number,
        supplier: bill.supplier?.name ?? "Supplier",
        date: new Date(bill.date).toLocaleDateString("en-GB"),
        rawDate: bill.date,
        total: Number(bill.total).toLocaleString("en-GB"),
        rawAmount: Number(bill.total),
        status: bill.status,
      })),
    [purchaseBills],
  );

  const movementRows = useMemo(
    () =>
      stockMovements.map((movement) => ({
        id: String(movement.id),
        product: movement.product?.name ?? `Product ${movement.productId}`,
        warehouse: movement.warehouse?.name ?? `Warehouse ${movement.warehouseId}`,
        quantity: Number(movement.quantity).toLocaleString("en-GB"),
        rawQuantity: Number(movement.quantity),
        direction: movement.direction,
        createdAt: new Date(movement.createdAt).toLocaleString("en-GB"),
        rawTimestamp: movement.createdAt,
      })),
    [stockMovements],
  );

  return (
    <WorkspaceShell
      title="Supply Chain Management"
      description="Oversee demand, procurement, inbound receipts, and warehouse movement from one operational view."
      requiredRoles={["procurement", "inventory", "accountant", "admin", "ceo"]}
      tabs={scmViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryLabel="Review live flow"
          onPrimaryAction={() => document.getElementById("scm-live-touchpoints")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          summary="Cross-module supply visibility now reads from live purchasing and warehouse records instead of browser-local state."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Operational touchpoints",
                  description: "Jump to live procurement and warehouse context",
                  onSelect: () => document.getElementById("scm-live-touchpoints")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Vendor bills",
                  description: "Jump to inbound purchasing records",
                  onSelect: () => document.getElementById("scm-vendor-bills")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Stock movements",
                  description: "Jump to warehouse movement records",
                  onSelect: () => document.getElementById("scm-stock-movements")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Inventory valuation", href: "/inventory", description: "Open warehouse and valuation tools" },
                { label: "Operational reports", href: "/reports", description: "Open the central reporting workspace" },
              ],
            },
            {
              label: "More",
              items: [
                { label: "Procurement workspace", href: "/procurement", description: "Manage suppliers and vendor bills" },
                { label: "Inventory workspace", href: "/inventory", description: "Manage stock movement and fulfillment" },
                {
                  label: "Journal impact",
                  description: "Open Finance to review ledger-linked postings",
                  onSelect: () => router.push("/finance"),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="inventory" />)}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Supply chain flow board" eyebrow="Cross-functional lane status">
          <div id="scm-flow-board" />
          <DataTable
            title="Supply lanes"
            tableId="scm-lanes"
            exportFileName="scm-lanes"
            rows={laneRows}
            searchValue={(row) => `${row.lane} ${row.owner} ${row.risk}`}
            advancedFilters={[
              { key: "lane", label: "Lane", type: "text", getValue: (row) => row.lane },
              { key: "owner", label: "Owner", type: "text", getValue: (row) => row.owner },
              { key: "risk", label: "Risk", type: "select", getValue: (row) => row.risk, options: [...new Set(laneRows.map((row) => row.risk))].map((value) => ({ value, label: value })) },
              { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [...new Set(laneRows.map((row) => row.status))].map((value) => ({ value, label: value })) },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle="No connected supply lanes yet"
            emptyMessage="Supply-chain lanes will be derived once procurement bills or warehouse movements exist in the database."
            columns={[
              { key: "lane", label: "Lane", render: (row) => <strong>{row.lane}</strong>, exportValue: (row) => row.lane },
              { key: "owner", label: "Owner", render: (row) => row.owner, exportValue: (row) => row.owner },
              { key: "volume", label: "Volume", render: (row) => row.volume, exportValue: (row) => row.volume },
              { key: "risk", label: "Risk", render: (row) => row.risk, exportValue: (row) => row.risk },
              { key: "status", label: "Status", render: (row) => row.status, exportValue: (row) => row.status },
            ]}
          />
        </SectionCard>

        <SectionCard title="Operational touchpoints" eyebrow="Live module data">
          <div id="scm-live-touchpoints" className="action-stack">
            <article className="action-card left-align">
              <strong>Vendor bills</strong>
              <span>{purchaseBills.length} live purchasing records are currently feeding the inbound pipeline.</span>
            </article>
            <article className="action-card left-align">
              <strong>Warehouse movements</strong>
              <span>{stockMovements.length} live stock movements are affecting replenishment and fulfillment.</span>
            </article>
            <article className="action-card left-align">
              <strong>Source of truth</strong>
              <span>This page now reflects database-backed procurement and inventory activity, not browser-only drafts.</span>
            </article>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Recent vendor bills" eyebrow="Live procurement">
          <div id="scm-vendor-bills" />
          <DataTable
            title="Vendor bills"
            tableId="scm-bills"
            exportFileName="scm-vendor-bills"
            rows={billRows}
            searchValue={(row) => `${row.number} ${row.supplier} ${row.status}`}
            advancedFilters={[
              { key: "billNumber", label: "Bill", type: "text", getValue: (row) => row.number },
              { key: "supplier", label: "Supplier", type: "text", getValue: (row) => row.supplier },
              { key: "date", label: "Bill date", type: "date-range", getValue: (row) => row.rawDate ?? row.date },
              { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [...new Set(billRows.map((row) => row.status))].map((value) => ({ value, label: value })) },
              { key: "total", label: "Total", type: "number-range", getValue: (row) => row.rawAmount ?? row.total },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            columns={[
              { key: "number", label: "Bill", render: (row) => <strong>{row.number}</strong> },
              { key: "supplier", label: "Supplier", render: (row) => row.supplier },
              { key: "date", label: "Date", render: (row) => row.date },
              { key: "total", label: "Total", className: "numeric", render: (row) => row.total },
              { key: "status", label: "Status", render: (row) => row.status },
            ]}
          />
        </SectionCard>

        <SectionCard title="Recent stock movements" eyebrow="Live warehouse log">
          <div id="scm-stock-movements" />
          <DataTable
            title="Warehouse movements"
            tableId="scm-movements"
            exportFileName="scm-stock-movements"
            rows={movementRows}
            searchValue={(row) => `${row.product} ${row.warehouse} ${row.direction}`}
            advancedFilters={[
              { key: "product", label: "Product", type: "text", getValue: (row) => row.product },
              { key: "warehouse", label: "Warehouse", type: "select", getValue: (row) => row.warehouse, options: [...new Set(movementRows.map((row) => row.warehouse))].map((value) => ({ value, label: value })) },
              { key: "direction", label: "Direction", type: "select", getValue: (row) => row.direction, options: [...new Set(movementRows.map((row) => row.direction))].map((value) => ({ value, label: value })) },
              { key: "timestamp", label: "Timestamp", type: "date-range", getValue: (row) => row.rawTimestamp ?? row.createdAt },
              { key: "quantity", label: "Quantity", type: "number-range", getValue: (row) => row.rawQuantity ?? row.quantity },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            columns={[
              { key: "product", label: "Product", render: (row) => <strong>{row.product}</strong> },
              { key: "warehouse", label: "Warehouse", render: (row) => row.warehouse },
              { key: "direction", label: "Direction", render: (row) => row.direction },
              { key: "quantity", label: "Quantity", className: "numeric", render: (row) => row.quantity },
              { key: "createdAt", label: "Timestamp", render: (row) => row.createdAt },
            ]}
          />
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
