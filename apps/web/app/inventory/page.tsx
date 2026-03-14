"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { ProcessArchitecturePanel } from "../../components/ui/process-architecture-panel";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  createInventoryStockMovement,
  getInventoryProducts,
  getInventoryStockMovements,
  getInventoryWarehouses,
  type InventoryProduct,
  type InventoryStockMovement,
  type InventoryWarehouse,
} from "../../lib/api";
import { inventoryViews, type KpiMetric, type TimelineItem } from "../../lib/erp";
import { buildInventoryWorkflow } from "../../lib/process-flows";

function formatQuantity(value: string | number) {
  return Number(value).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function InventoryPage() {
  const { session, activeCompany } = useWorkspace();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Create inventory movements here. A movement only appears after the database confirms the transaction.");
  const [draftMovement, setDraftMovement] = useState({
    productId: "" as number | "",
    warehouseId: "" as number | "",
    quantity: 1,
    direction: "IN" as "IN" | "OUT",
    reference: "",
  });

  async function loadInventoryData(token: string) {
    setLoading(true);
    try {
      const [productRows, warehouseRows, movementRows] = await Promise.all([
        getInventoryProducts(token, activeCompany?.id),
        getInventoryWarehouses(token, activeCompany?.id),
        getInventoryStockMovements(token, activeCompany?.id),
      ]);
      setProducts(productRows);
      setWarehouses(warehouseRows);
      setMovements(movementRows);
      setDraftMovement((current) => ({
        ...current,
        productId: current.productId || productRows[0]?.id || "",
        warehouseId: current.warehouseId || warehouseRows[0]?.id || "",
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load inventory data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadInventoryData(session.token);
  }, [activeCompany?.id, session?.token]);

  const rows = useMemo(
    () =>
      movements.map((movement) => ({
        id: String(movement.id),
        item: movement.product?.name ?? "Unmapped product",
        warehouse: movement.warehouse?.name ?? "Unmapped warehouse",
        type: movement.direction === "IN" ? "Receipt" : "Issue",
        quantity: formatQuantity(movement.quantity),
        rawQuantity: Number(movement.quantity ?? 0),
        timestamp: formatDateTime(movement.createdAt),
        rawTimestamp: movement.createdAt,
        status: movement.direction === "IN" ? "Submitted" : "Approved",
        reference: movement.reference || "-",
      })),
    [movements],
  );

  const inboundCount = useMemo(
    () => movements.filter((movement) => Number(movement.quantity) > 0 || movement.direction === "IN").length,
    [movements],
  );

  const inventoryMetrics = useMemo<KpiMetric[]>(
    () => [
      {
        label: "Products",
        value: String(products.length),
        delta: "Live item master",
        trend: products.length ? "up" : "neutral",
        detail: "Products mapped to inventory transactions",
      },
      {
        label: "Warehouses",
        value: String(warehouses.length),
        delta: "Storage locations",
        trend: warehouses.length ? "up" : "neutral",
        detail: "Warehouses available for stock movement",
      },
      {
        label: "Movements",
        value: String(movements.length),
        delta: "Database-backed log",
        trend: movements.length ? "up" : "neutral",
        detail: "Inventory transactions saved in the ERP database",
      },
      {
        label: "Receipts",
        value: String(inboundCount),
        delta: "Inbound flow",
        trend: inboundCount ? "up" : "neutral",
        detail: "Receipt transactions recorded in live stock movements",
      },
    ],
    [inboundCount, movements.length, products.length, warehouses.length],
  );

  const inventoryAlerts = useMemo(
    () =>
      [
        products.length === 0
          ? { id: "inv-no-products", title: "No products mapped", detail: "Create or import products before recording stock movement.", severity: "warning" as const }
          : null,
        warehouses.length === 0
          ? { id: "inv-no-warehouses", title: "No warehouses mapped", detail: "Create warehouse records so inventory transactions can be assigned correctly.", severity: "warning" as const }
          : null,
        movements.length > 0
          ? { id: "inv-live-log", title: "Movement log is live", detail: `${movements.length} stock movement(s) are being read from the ERP database.`, severity: "info" as const }
          : null,
      ].filter(Boolean) as Array<{ id: string; title: string; detail: string; severity: "critical" | "warning" | "info" }>,
    [movements.length, products.length, warehouses.length],
  );

  const inventoryTimeline = useMemo<TimelineItem[]>(
    () =>
      movements.slice(0, 5).map((movement) => ({
        id: `movement-${movement.id}`,
        title: movement.direction === "IN" ? "Receipt posted" : "Issue posted",
        subtitle: movement.product?.name ?? "Unmapped product",
        timestamp: formatDateTime(movement.createdAt),
        user: movement.warehouse?.name ?? "Unmapped warehouse",
        status: movement.direction === "IN" ? "Submitted" : "Approved",
      })),
    [movements],
  );

  const processBlueprint = useMemo(
    () =>
      buildInventoryWorkflow({
        productCount: products.length,
        warehouseCount: warehouses.length,
        movementCount: movements.length,
        inboundCount,
      }),
    [inboundCount, movements.length, products.length, warehouses.length],
  );

  function scrollToDesk() {
    document.getElementById("inventory-action-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveMovement() {
    if (!session?.token) {
      setMessage("You need an active session before saving an inventory movement.");
      return;
    }
    if (!draftMovement.productId || !draftMovement.warehouseId || draftMovement.quantity <= 0) {
      setMessage("Select a product and warehouse, then enter a quantity greater than zero.");
      scrollToDesk();
      return;
    }

    setSaving(true);
    try {
      await createInventoryStockMovement(session.token, {
        productId: Number(draftMovement.productId),
        warehouseId: Number(draftMovement.warehouseId),
        quantity: Number(draftMovement.quantity),
        direction: draftMovement.direction,
        reference: draftMovement.reference.trim() || undefined,
      });
      await loadInventoryData(session.token);
      setDraftMovement((current) => ({
        ...current,
        quantity: 1,
        reference: "",
      }));
      setMessage("Inventory movement saved to the database and the live movement log has been refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save inventory movement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceShell
      title="Inventory"
      description="Control item balances, warehouse actions, and stock movements from one live inventory workspace."
      requiredRoles={["inventory", "procurement", "accountant", "admin", "ceo"]}
      tabs={inventoryViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={saveMovement} disabled={saving || loading}>
              {saving ? "Saving..." : "Save movement"}
            </button>
          }
          summary="Movement entry stays visible. Refresh, valuation, and exception review are grouped above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh movement log",
                  description: "Reload products, warehouses, and stock movements",
                  onSelect: () => session?.token && loadInventoryData(session.token),
                },
                {
                  label: "Open action desk",
                  description: "Jump back to movement entry",
                  onSelect: scrollToDesk,
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Valuation", href: "/inventory?view=Valuation", description: "Inventory value and cost review" },
                { label: "Reorder planning", href: "/inventory?view=Reorder%20Planning", description: "Replenishment and shortages" },
              ],
            },
          ]}
        />
      }
    >
      <ProcessArchitecturePanel
        blueprint={processBlueprint}
        checklistActions={{
          "inv-items": {
            label: products.length ? "Review items" : "Import items",
            href: products.length ? "/inventory?view=Items" : "/administration?view=Import%20%26%20Export",
          },
          "inv-warehouses": {
            label: warehouses.length ? "Review warehouses" : "Set up warehouse",
            href: warehouses.length ? "/inventory?view=Warehouses" : "/administration?view=Organization%20Setup",
          },
          "inv-opening": {
            label: inboundCount ? "Open movement log" : "Create first receipt",
            onSelect: scrollToDesk,
          },
        }}
        nextActions={[
          {
            id: "inv-next-receipt",
            label: "Record stock receipt",
            detail: "Use the movement desk to establish opening stock or inbound receipts.",
            onSelect: scrollToDesk,
          },
          {
            id: "inv-next-reorder",
            label: "Review reorder planning",
            detail: "Move into planning once enough movement history exists for replenishment insight.",
            href: "/inventory?view=Reorder%20Planning",
          },
          {
            id: "inv-next-procurement",
            label: "Follow inbound supply",
            detail: "Use procurement when new stock must be sourced before inventory can move again.",
            href: "/procurement",
          },
        ]}
      />

      <section className="kpi-grid">
        {inventoryMetrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="inventory" />
        ))}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Inventory action desk" eyebrow="Database-backed movements">
          {(!products.length || !warehouses.length) && !loading ? (
            <EmptyState
              tone="inventory"
              title="Setup needed before movement entry"
              body="Make sure products and warehouses exist before saving stock transactions."
            />
          ) : null}

          <div className="action-form-stack" id="inventory-action-desk">
            <div className="form-grid two-up">
              <label className="field">
                <span>Product</span>
                <select
                  className="select-input"
                  value={draftMovement.productId}
                  onChange={(event) => setDraftMovement((current) => ({ ...current, productId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Warehouse</span>
                <select
                  className="select-input"
                  value={draftMovement.warehouseId}
                  onChange={(event) => setDraftMovement((current) => ({ ...current, warehouseId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Direction</span>
                <select
                  className="select-input"
                  value={draftMovement.direction}
                  onChange={(event) => setDraftMovement((current) => ({ ...current, direction: event.target.value as "IN" | "OUT" }))}
                >
                  <option value="IN">Receipt</option>
                  <option value="OUT">Issue</option>
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
                <input type="number" min="0" value={draftMovement.quantity} onChange={(event) => setDraftMovement((current) => ({ ...current, quantity: Number(event.target.value) }))} />
              </label>
            </div>

            <label className="field">
              <span>Reference</span>
              <input value={draftMovement.reference} onChange={(event) => setDraftMovement((current) => ({ ...current, reference: event.target.value }))} placeholder="e.g. GRN-1024, COUNT-MAR, ISSUE-17" />
            </label>

            <div className="inline-actions compact-end">
              <button className="primary-button" type="button" onClick={saveMovement} disabled={saving || loading}>
                {saving ? "Saving..." : "Save inventory movement"}
              </button>
            </div>
            <p className="note">{message}</p>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Stock movement log" eyebrow="Live records">
          <DataTable
            title="Latest movements"
            tableId="inventory-movements"
            exportFileName="inventory-movements"
            rows={rows}
            searchValue={(row) => `${row.id} ${row.item} ${row.warehouse} ${row.type} ${row.reference}`}
            filters={[
              { key: "issues", label: "Issues", predicate: (row) => row.type === "Issue" },
              { key: "receipts", label: "Receipts", predicate: (row) => row.type === "Receipt" },
            ]}
            advancedFilters={[
              { key: "item", label: "Item", type: "text", placeholder: "Filter by item", getValue: (row) => row.item },
              { key: "warehouse", label: "Warehouse", type: "select", options: [...new Set(rows.map((row) => row.warehouse))].map((value) => ({ label: value, value })), getValue: (row) => row.warehouse },
              { key: "type", label: "Movement type", type: "select", options: [{ label: "Receipt", value: "Receipt" }, { label: "Issue", value: "Issue" }], getValue: (row) => row.type },
              { key: "timestamp", label: "Movement date", type: "date-range", getValue: (row) => row.rawTimestamp },
              { key: "quantity", label: "Quantity", type: "number-range", minPlaceholder: "Min qty", maxPlaceholder: "Max qty", getValue: (row) => row.rawQuantity },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading stock movements" : "No stock movements yet"}
            emptyMessage={loading ? "Reading the live stock movement log from the API." : "Save an inventory movement above and it will appear here after the database confirms it."}
            columns={[
              { key: "id", label: "Movement", render: (row) => <strong>{row.id}</strong> },
              { key: "item", label: "Item", render: (row) => <div><strong>{row.item}</strong><p className="cell-subcopy">{row.warehouse}</p></div> },
              { key: "type", label: "Type", render: (row) => row.type },
              { key: "quantity", label: "Quantity", className: "numeric", render: (row) => row.quantity },
              { key: "reference", label: "Reference", render: (row) => row.reference },
              { key: "timestamp", label: "Timestamp", render: (row) => row.timestamp },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status as "Submitted" | "Approved"} /> },
            ]}
          />
        </SectionCard>

        <SectionCard title="Inventory exceptions" eyebrow="Action queue">
          <div className="alert-list compact">
            {inventoryAlerts.map((alert) => (
              <article key={alert.id} className={`alert-row ${alert.severity}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              </article>
            ))}
            {!inventoryAlerts.length ? (
              <EmptyState tone="inventory" title="No live inventory exceptions" body="This section now shows only setup and movement warnings derived from database records." />
            ) : null}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Recent warehouse activity" eyebrow="Audit trail">
        {inventoryTimeline.length ? (
          <ActivityTimeline items={inventoryTimeline} />
        ) : (
          <EmptyState tone="inventory" title="No warehouse activity yet" body="Recent movement activity will appear here after inventory transactions are saved." />
        )}
      </SectionCard>
    </WorkspaceShell>
  );
}
