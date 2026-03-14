"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { ProcessArchitecturePanel } from "../../components/ui/process-architecture-panel";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  createPurchaseBill,
  createPurchaseSupplier,
  getInventoryProducts,
  getInventoryWarehouses,
  getPurchaseBills,
  getPurchaseSuppliers,
  getTaxConfigs,
  type InventoryProduct,
  type InventoryWarehouse,
  type PurchaseBillRecord,
  type PurchaseSupplier,
  type TaxConfigRecord,
} from "../../lib/api";
import { procurementViews, type KpiMetric } from "../../lib/erp";
import { buildProcurementWorkflow } from "../../lib/process-flows";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export default function ProcurementPage() {
  const { session, activeBranch, activeCompany } = useWorkspace();
  const [suppliers, setSuppliers] = useState<PurchaseSupplier[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [bills, setBills] = useState<PurchaseBillRecord[]>([]);
  const [taxConfigs, setTaxConfigs] = useState<TaxConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBill, setSavingBill] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [message, setMessage] = useState("Create a supplier or vendor bill here. Records appear only after the database confirms the save.");
  const [supplierDraft, setSupplierDraft] = useState({ name: "", email: "", phone: "" });
  const [billDraft, setBillDraft] = useState({
    supplierId: "" as number | "",
    productId: "" as number | "",
    quantity: 1,
    unitCost: 0,
    taxRate: 0,
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    warehouseId: "" as number | "",
  });

  async function loadProcurementData(token: string) {
    setLoading(true);
    try {
      const [supplierRows, billRows, productRows, warehouseRows, taxRows] = await Promise.all([
        getPurchaseSuppliers(token, activeCompany?.id),
        getPurchaseBills(token, activeCompany?.id),
        getInventoryProducts(token, activeCompany?.id),
        getInventoryWarehouses(token, activeCompany?.id),
        activeCompany?.id ? getTaxConfigs(token, activeCompany.id) : Promise.resolve([]),
      ]);
      setSuppliers(supplierRows);
      setBills(billRows);
      setProducts(productRows);
      setWarehouses(warehouseRows);
      setTaxConfigs(taxRows);
      setBillDraft((current) => ({
        ...current,
        supplierId: current.supplierId || supplierRows[0]?.id || "",
        productId: current.productId || productRows[0]?.id || "",
        warehouseId: current.warehouseId || warehouseRows[0]?.id || "",
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load procurement data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadProcurementData(session.token);
  }, [activeCompany?.id, session?.token]);

  const rows = useMemo(
    () =>
      bills.map((bill) => ({
        id: String(bill.id),
        number: bill.number,
        supplier: bill.supplier?.name ?? "Unmapped supplier",
        date: new Date(bill.date).toLocaleDateString("en-GB"),
        rawDate: bill.date,
        dueDate: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-GB") : "-",
        rawDueDate: bill.dueDate ?? "",
        amount: formatCurrency(toNumber(bill.total)),
        rawAmount: toNumber(bill.total),
        items: bill.items.length,
        branch: activeBranch?.name ?? bill.supplier?.addresses?.[0]?.city ?? "-",
        status: (bill.status === "OPEN" ? "Submitted" : "Draft") as "Submitted" | "Draft",
      })),
    [activeBranch?.name, bills],
  );

  const procurementMetrics = useMemo<KpiMetric[]>(
    () => [
      {
        label: "Suppliers",
        value: String(suppliers.length),
        delta: "Live supplier master",
        trend: suppliers.length ? "up" : "neutral",
        detail: "Suppliers available for billing and sourcing",
      },
      {
        label: "Vendor bills",
        value: String(bills.length),
        delta: "Database-backed register",
        trend: bills.length ? "up" : "neutral",
        detail: "Bills stored in the ERP database",
      },
      {
        label: "Products ready",
        value: String(products.length),
        delta: "Item master",
        trend: products.length ? "up" : "neutral",
        detail: "Products available for procurement billing",
      },
      {
        label: "Tax codes",
        value: String(taxConfigs.length),
        delta: "Mapped tax setup",
        trend: taxConfigs.length ? "up" : "neutral",
        detail: "Tax configurations available for purchasing",
      },
    ],
    [bills.length, products.length, suppliers.length, taxConfigs.length],
  );

  const procurementAlerts = useMemo(
    () =>
      [
        suppliers.length === 0
          ? { id: "proc-no-suppliers", title: "No suppliers mapped", detail: "Create at least one supplier before entering vendor bills.", severity: "warning" as const }
          : null,
        products.length === 0
          ? { id: "proc-no-products", title: "No products mapped", detail: "Import or create products so bills can reference valid items.", severity: "warning" as const }
          : null,
        warehouses.length === 0
          ? { id: "proc-no-warehouses", title: "No warehouses mapped", detail: "Warehouse selection is empty, so stock-linked receipts cannot be assigned.", severity: "info" as const }
          : null,
        bills.length > 0
          ? { id: "proc-bills-live", title: "Vendor bills are live", detail: `${bills.length} purchasing record(s) are coming from the ERP database.`, severity: "info" as const }
          : null,
      ].filter(Boolean) as Array<{ id: string; title: string; detail: string; severity: "critical" | "warning" | "info" }>,
    [bills.length, products.length, suppliers.length, warehouses.length],
  );

  const processBlueprint = useMemo(
    () =>
      buildProcurementWorkflow({
        supplierCount: suppliers.length,
        productCount: products.length,
        warehouseCount: warehouses.length,
        taxCodeCount: taxConfigs.length,
        billCount: bills.length,
      }),
    [bills.length, products.length, suppliers.length, taxConfigs.length, warehouses.length],
  );

  function scrollToDesk(id = "procurement-action-desk") {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreateSupplier() {
    if (!session?.token || !activeCompany?.id) {
      setMessage("You need an active session before creating suppliers.");
      return;
    }
    if (!supplierDraft.name.trim()) {
      setMessage("Supplier name is required.");
      scrollToDesk("procurement-supplier-desk");
      return;
    }

    setSavingSupplier(true);
    try {
      const supplier = await createPurchaseSupplier(session.token, {
        companyId: activeCompany.id,
        name: supplierDraft.name.trim(),
        email: supplierDraft.email.trim() || undefined,
        phone: supplierDraft.phone.trim() || undefined,
      });
      await loadProcurementData(session.token);
      setBillDraft((current) => ({ ...current, supplierId: supplier.id }));
      setSupplierDraft({ name: "", email: "", phone: "" });
      setMessage(`${supplier.name} was saved to the supplier master and is now available for bills.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create supplier.");
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleCreateBill() {
    if (!session?.token || !activeCompany?.id) {
      setMessage("You need an active session before saving a vendor bill.");
      return;
    }
    if (!billDraft.supplierId || !billDraft.productId || billDraft.quantity <= 0 || billDraft.unitCost <= 0) {
      setMessage("Select a supplier and product, then enter a quantity and unit cost greater than zero.");
      scrollToDesk();
      return;
    }

    setSavingBill(true);
    try {
      await createPurchaseBill(session.token, {
        legalEntityId: activeCompany.id,
        supplierId: Number(billDraft.supplierId),
        date: billDraft.date,
        dueDate: billDraft.dueDate || undefined,
        warehouseId: billDraft.warehouseId ? Number(billDraft.warehouseId) : undefined,
        items: [
          {
            productId: Number(billDraft.productId),
            quantity: Number(billDraft.quantity),
            unitCost: Number(billDraft.unitCost),
            taxRate: Number(billDraft.taxRate || 0),
          },
        ],
      });
      await loadProcurementData(session.token);
      setBillDraft((current) => ({
        ...current,
        quantity: 1,
        unitCost: 0,
        taxRate: 0,
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }));
      setMessage("Vendor bill saved to the database and the purchasing register has been refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create vendor bill.");
    } finally {
      setSavingBill(false);
    }
  }

  return (
    <WorkspaceShell
      title="Procurement"
      description="Source faster, keep approvals moving, and save supplier and bill records directly into the ERP."
      requiredRoles={["procurement", "cfo", "accountant", "admin", "ceo"]}
      tabs={procurementViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={() => scrollToDesk()}>
              New vendor bill
            </button>
          }
          summary="Supplier and bill creation stay visible. Queue access and AP/report links are grouped above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh register",
                  description: "Reload supplier, warehouse, product, and bill data",
                  onSelect: () => session?.token && loadProcurementData(session.token),
                },
                {
                  label: "New supplier",
                  description: "Jump to supplier onboarding",
                  onSelect: () => scrollToDesk("procurement-supplier-desk"),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Payables", href: "/finance?view=Accounts%20Payable", description: "Open AP follow-through" },
                { label: "Spend analysis", href: "/reports", description: "Supplier and spend reporting" },
              ],
            },
          ]}
        />
      }
    >
      <ProcessArchitecturePanel
        blueprint={processBlueprint}
        checklistActions={{
          "proc-suppliers": {
            label: suppliers.length ? "Review suppliers" : "Create supplier",
            onSelect: () => scrollToDesk("procurement-supplier-desk"),
          },
          "proc-items": {
            label: products.length ? "Open item master" : "Import items",
            href: products.length ? "/inventory?view=Items" : "/administration?view=Import%20%26%20Export",
          },
          "proc-warehouses": {
            label: warehouses.length ? "Review warehouses" : "Set up warehouses",
            href: warehouses.length ? "/inventory?view=Warehouses" : "/administration?view=Organization%20Setup",
          },
          "proc-tax": {
            label: taxConfigs.length ? "Review tax" : "Configure tax",
            href: "/tax",
          },
        }}
        nextActions={[
          {
            id: "proc-next-bill",
            label: "Create supplier bill",
            detail: "Start the live procurement transaction from the vendor bill desk.",
            onSelect: () => scrollToDesk(),
          },
          {
            id: "proc-next-receipt",
            label: "Review inbound stock",
            detail: "Check inventory movements created from warehouse-backed procurement receipts.",
            href: "/inventory?view=Stock%20Movements",
          },
          {
            id: "proc-next-payables",
            label: "Follow to payables",
            detail: "Move from posted bills into accounts payable and payment follow-through.",
            href: "/finance?view=Accounts%20Payable",
          },
        ]}
      />

      <section className="kpi-grid">
        {procurementMetrics.map((metric) => (
          <KpiCard key={metric.label} metric={metric} tone="procurement" />
        ))}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Vendor bill desk" eyebrow="Database-backed entry">
          {(!suppliers.length || !products.length) && !loading ? (
            <EmptyState
              tone="procurement"
              title="Setup needed before billing"
              body="Create at least one supplier and make sure products exist before saving a vendor bill."
            />
          ) : null}

          <div className="action-form-stack" id="procurement-action-desk">
            <div className="form-grid two-up">
              <label className="field">
                <span>Supplier</span>
                <select
                  className="select-input"
                  value={billDraft.supplierId}
                  onChange={(event) => setBillDraft((current) => ({ ...current, supplierId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Warehouse</span>
                <select
                  className="select-input"
                  value={billDraft.warehouseId}
                  onChange={(event) => setBillDraft((current) => ({ ...current, warehouseId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">No stock receipt</option>
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
                <span>Bill date</span>
                <input type="date" value={billDraft.date} onChange={(event) => setBillDraft((current) => ({ ...current, date: event.target.value }))} />
              </label>
              <label className="field">
                <span>Due date</span>
                <input type="date" value={billDraft.dueDate} onChange={(event) => setBillDraft((current) => ({ ...current, dueDate: event.target.value }))} />
              </label>
            </div>

            <div className="form-grid three-up">
              <label className="field">
                <span>Product</span>
                <select
                  className="select-input"
                  value={billDraft.productId}
                  onChange={(event) => setBillDraft((current) => ({ ...current, productId: event.target.value ? Number(event.target.value) : "" }))}
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
                <span>Quantity</span>
                <input type="number" min="0" value={billDraft.quantity} onChange={(event) => setBillDraft((current) => ({ ...current, quantity: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Unit cost</span>
                <input type="number" min="0" value={billDraft.unitCost} onChange={(event) => setBillDraft((current) => ({ ...current, unitCost: Number(event.target.value) }))} />
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Tax rate %</span>
                <input type="number" min="0" value={billDraft.taxRate} onChange={(event) => setBillDraft((current) => ({ ...current, taxRate: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Total</span>
                <input value={formatCurrency(billDraft.quantity * billDraft.unitCost * (1 + billDraft.taxRate / 100))} readOnly />
              </label>
            </div>

            <div className="inline-actions compact-end">
              <button className="primary-button" type="button" onClick={handleCreateBill} disabled={savingBill || loading}>
                {savingBill ? "Saving..." : "Save vendor bill"}
              </button>
            </div>
            <p className="note">{message}</p>
          </div>
        </SectionCard>

        <SectionCard title="Supplier onboarding" eyebrow="Live supplier master">
          <div className="action-form-stack" id="procurement-supplier-desk">
            <label className="field">
              <span>Supplier name</span>
              <input value={supplierDraft.name} onChange={(event) => setSupplierDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Northline Chemicals" />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={supplierDraft.email} onChange={(event) => setSupplierDraft((current) => ({ ...current, email: event.target.value }))} placeholder="e.g. payables@northline.com" />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={supplierDraft.phone} onChange={(event) => setSupplierDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="e.g. +2348000000000" />
            </label>
            <div className="inline-actions compact-end">
              <button className="ghost-button" type="button" onClick={handleCreateSupplier} disabled={savingSupplier}>
                {savingSupplier ? "Saving..." : "Create supplier"}
              </button>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Vendor bill register" eyebrow="Source of truth">
          <div id="procurement-queue" />
          <DataTable
            title="Stored purchasing records"
            tableId="procurement-bills"
            exportFileName="procurement-bills"
            rows={rows}
            searchValue={(row) => `${row.number} ${row.supplier} ${row.amount} ${row.status}`}
            filters={[
              { key: "submitted", label: "Submitted", predicate: (row) => row.status === "Submitted" },
              { key: "draft", label: "Draft", predicate: (row) => row.status === "Draft" },
            ]}
            advancedFilters={[
              { key: "supplier", label: "Supplier", type: "text", placeholder: "Filter by supplier", getValue: (row) => row.supplier },
              { key: "status", label: "Status", type: "select", options: [{ label: "Submitted", value: "Submitted" }, { label: "Draft", value: "Draft" }], getValue: (row) => row.status },
              { key: "branch", label: "Branch", type: "select", options: [...new Set(rows.map((row) => row.branch))].map((value) => ({ label: value, value })), getValue: (row) => row.branch },
              { key: "date", label: "Bill date", type: "date-range", getValue: (row) => row.rawDate },
              { key: "amount", label: "Amount", type: "number-range", minPlaceholder: "Min amount", maxPlaceholder: "Max amount", getValue: (row) => row.rawAmount },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading vendor bills" : "No vendor bills yet"}
            emptyMessage={loading ? "Reading the purchasing register from the API." : "Save a vendor bill above and it will appear here after the database confirms it."}
            columns={[
              { key: "number", label: "Bill", render: (row) => <strong>{row.number}</strong> },
              { key: "supplier", label: "Supplier", render: (row) => <div><strong>{row.supplier}</strong><p className="cell-subcopy">{row.branch}</p></div> },
              { key: "date", label: "Date", render: (row) => row.date },
              { key: "dueDate", label: "Due", render: (row) => row.dueDate },
              { key: "items", label: "Lines", className: "numeric", render: (row) => row.items },
              { key: "amount", label: "Amount", className: "numeric", render: (row) => row.amount },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </SectionCard>

        <SectionCard title="Approvals and supplier actions" eyebrow="Work queue">
          <div className="approval-mini-list">
            {procurementAlerts.map((alert) => (
              <article key={alert.id} className={`alert-row ${alert.severity}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              </article>
            ))}
            {!procurementAlerts.length ? (
              <EmptyState tone="procurement" title="No live procurement exceptions" body="This section only shows database-derived setup and bill warnings now." />
            ) : null}
          </div>
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
