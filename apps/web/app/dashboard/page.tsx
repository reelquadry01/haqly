"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  approveJournalEntry,
  getAccountingJournals,
  getFiscalYears,
  getInventoryProducts,
  getInventoryStockMovements,
  getInventoryWarehouses,
  getJournalEntries,
  getPurchaseBills,
  getPurchaseSuppliers,
  getSalesCustomers,
  getSalesInvoices,
  getTaxConfigs,
  getUsers,
  rejectJournalEntry,
  updateSalesCustomer,
  type AccountingJournal,
  type FiscalYearRecord,
  type InventoryProduct,
  type InventoryStockMovement,
  type InventoryWarehouse,
  type JournalEntryRecord,
  type PurchaseBillRecord,
  type PurchaseSupplier,
  type SalesCustomer,
  type SalesInvoiceRecord,
  type TaxConfigRecord,
  type UserRecord,
} from "../../lib/api";
import {
  getRoleLabel,
  type ActionItem,
  type AlertItem,
  type AppRole,
  type AppStatus,
  type ApprovalStep,
  type KpiMetric,
  type TimelineItem,
} from "../../lib/erp";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { ApprovalStepper } from "../../components/ui/approval-stepper";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";

const roleToneMap: Record<AppRole, "finance" | "procurement" | "inventory" | "payroll" | "reports" | "admin"> = {
  cfo: "finance",
  accountant: "finance",
  procurement: "procurement",
  inventory: "inventory",
  hr: "payroll",
  admin: "admin",
  ceo: "reports",
};

const roleSummaryMap: Record<AppRole, string> = {
  cfo: "Live cash, approvals, commercial activity, and period controls in one executive workspace.",
  accountant: "Stay close to journals, exceptions, open periods, and documents that still need finance attention.",
  procurement: "Track supplier readiness, committed spend, and inventory-linked purchasing from one operational view.",
  inventory: "Follow warehouse movement, item readiness, and downstream stock impact from one operational view.",
  hr: "Keep payroll readiness, employee records, and finance dependencies visible from one HR workspace.",
  admin: "Monitor access, periods, controls, and cross-module readiness from a single administration console.",
  ceo: "See live commercial, procurement, and finance movement without a dashboard full of made-up numbers.",
};

const roleQuickActions: Record<AppRole, ActionItem[]> = {
  cfo: [
    { label: "New journal", hint: "GL controls", href: "/journal-entries" },
    { label: "Finance workspace", hint: "Ledger and close", href: "/finance" },
    { label: "Operational reports", hint: "Financial statements", href: "/reports" },
  ],
  accountant: [
    { label: "Review journals", hint: "Approve or post", href: "/journal-entries" },
    { label: "General ledger", hint: "Account activity", href: "/finance?view=General%20Ledger" },
    { label: "Trial balance", hint: "Opening, movement, closing", href: "/reports?view=Trial%20Balance" },
  ],
  procurement: [
    { label: "New vendor bill", hint: "Procurement desk", href: "/procurement" },
    { label: "Suppliers", hint: "Vendor readiness", href: "/procurement?view=Suppliers" },
    { label: "Supply chain", hint: "Operational handoffs", href: "/supply-chain" },
  ],
  inventory: [
    { label: "Receive stock", hint: "Inventory desk", href: "/inventory" },
    { label: "Stock movements", hint: "Warehouse flow", href: "/inventory?view=Stock%20Movements" },
    { label: "Supply chain", hint: "Upstream and downstream flow", href: "/supply-chain" },
  ],
  hr: [
    { label: "Payroll workspace", hint: "Cycle preparation", href: "/hr-payroll" },
    { label: "Reports", hint: "Financial and operational outputs", href: "/reports" },
    { label: "Administration", hint: "User and policy controls", href: "/administration" },
  ],
  admin: [
    { label: "Add user", hint: "Access control", href: "/administration" },
    { label: "Fiscal years", hint: "Periods and close", href: "/administration" },
    { label: "Audit-ready journals", hint: "Approval and posting", href: "/journal-entries" },
  ],
  ceo: [
    { label: "Executive BI", hint: "Live charts and trends", href: "/business-intelligence" },
    { label: "Reports", hint: "Financial statements", href: "/reports" },
    { label: "Finance workspace", hint: "Ledger and cash position", href: "/finance" },
  ],
};

type DashboardData = {
  customers: SalesCustomer[];
  suppliers: PurchaseSupplier[];
  products: InventoryProduct[];
  warehouses: InventoryWarehouse[];
  invoices: SalesInvoiceRecord[];
  bills: PurchaseBillRecord[];
  movements: InventoryStockMovement[];
  accountingJournals: AccountingJournal[];
  journalEntries: JournalEntryRecord[];
  users: UserRecord[];
  fiscalYears: FiscalYearRecord[];
  taxConfigs: TaxConfigRecord[];
};

type DashboardApproval = ApprovalStep & {
  kind: "journal" | "customer";
  journalId?: number;
  customerId?: number;
};

const emptyDashboardData: DashboardData = {
  customers: [],
  suppliers: [],
  products: [],
  warehouses: [],
  invoices: [],
  bills: [],
  movements: [],
  accountingJournals: [],
  journalEntries: [],
  users: [],
  fiscalYears: [],
  taxConfigs: [],
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatTimestamp(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

function normalizeStatus(status: string | null | undefined): AppStatus {
  switch ((status ?? "").toUpperCase()) {
    case "PENDING_APPROVAL":
    case "PENDING":
      return "Pending";
    case "SUBMITTED":
      return "Submitted";
    case "APPROVED":
      return "Approved";
    case "POSTED":
      return "Posted";
    case "REJECTED":
      return "Rejected";
    case "REVERSED":
      return "Reversed";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Archived";
    default:
      return "Draft";
  }
}

function isPermissionStyleError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("forbidden") || message.includes("unauthorized") || message.includes("permission");
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, activeCompany, activeBranch, loading: workspaceLoading } = useWorkspace();
  const role = session?.role ?? "cfo";
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!session?.token || !activeCompany?.id) {
      setDashboardData(emptyDashboardData);
      setLoading(false);
      return;
    }

    const currentSession = session;
    const currentCompany = activeCompany;

    let cancelled = false;

    async function fetchSafe<T>(label: string, task: () => Promise<T>, fallback: T, warnings: string[]) {
      try {
        return await task();
      } catch (error) {
        if (!isPermissionStyleError(error)) {
          warnings.push(label);
        }
        return fallback;
      }
    }

    async function loadDashboard() {
      setLoading(true);
      const warnings: string[] = [];

      const token = currentSession.token;
      const branchId = activeBranch?.id;
      const companyId = currentCompany.id;

      const [
        customers,
        suppliers,
        products,
        warehouses,
        invoices,
        bills,
        movements,
        accountingJournals,
        journalEntries,
        users,
        fiscalYears,
        taxConfigs,
      ] = await Promise.all([
        fetchSafe("customers", () => getSalesCustomers(token, companyId), [] as SalesCustomer[], warnings),
        fetchSafe("suppliers", () => getPurchaseSuppliers(token, companyId), [] as PurchaseSupplier[], warnings),
        fetchSafe("products", () => getInventoryProducts(token, companyId), [] as InventoryProduct[], warnings),
        fetchSafe("warehouses", () => getInventoryWarehouses(token, companyId), [] as InventoryWarehouse[], warnings),
        fetchSafe("invoices", () => getSalesInvoices(token, companyId), [] as SalesInvoiceRecord[], warnings),
        fetchSafe("purchase bills", () => getPurchaseBills(token, companyId), [] as PurchaseBillRecord[], warnings),
        fetchSafe("stock movements", () => getInventoryStockMovements(token, companyId), [] as InventoryStockMovement[], warnings),
        fetchSafe("legacy journals", () => getAccountingJournals(token), [] as AccountingJournal[], warnings),
        fetchSafe(
          "journal approvals",
          () => getJournalEntries(token, branchId ? { branchId } : undefined),
          [] as JournalEntryRecord[],
          warnings,
        ),
        fetchSafe("users", () => getUsers(token), [] as UserRecord[], warnings),
        fetchSafe("fiscal years", () => getFiscalYears(token, companyId), [] as FiscalYearRecord[], warnings),
        fetchSafe("tax configuration", () => getTaxConfigs(token, companyId), [] as TaxConfigRecord[], warnings),
      ]);

      if (cancelled) {
        return;
      }

      setDashboardData({
        customers,
        suppliers,
        products,
        warehouses,
        invoices,
        bills,
        movements,
        accountingJournals,
        journalEntries,
        users,
        fiscalYears,
        taxConfigs,
      });
      setLoadNote(
        warnings.length
          ? `Some live feeds are still unavailable for this role or are not fully wired yet: ${warnings.join(", ")}.`
          : "",
      );
      setLoading(false);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [activeBranch?.id, activeCompany?.id, refreshNonce, session?.token]);

  const derivedDashboard = useMemo(() => {
    const invoiceTotal = dashboardData.invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
    const billTotal = dashboardData.bills.reduce((sum, bill) => sum + toNumber(bill.total), 0);
    const pendingJournalEntries = dashboardData.journalEntries.filter((entry) => entry.status === "PENDING_APPROVAL");
    const draftJournalEntries = dashboardData.journalEntries.filter((entry) => entry.status === "DRAFT");
    const postedJournalEntries = dashboardData.journalEntries.filter((entry) => entry.status === "POSTED");
    const currentFiscalYear = dashboardData.fiscalYears.find((item) => item.isCurrent) ?? dashboardData.fiscalYears[0] ?? null;
    const openPeriods = currentFiscalYear?.counts.open ?? 0;
    const activeUsers = dashboardData.users.filter((item) => item.isActive).length;

    const metricsByRole: Record<AppRole, KpiMetric[]> = {
      cfo: [
        {
          label: "Sales billed",
          value: formatCurrency(invoiceTotal),
          delta: `${dashboardData.invoices.length} invoices`,
          trend: invoiceTotal > 0 ? "up" : "neutral",
          detail: "Live invoice value from the sales register",
        },
        {
          label: "Committed spend",
          value: formatCurrency(billTotal),
          delta: `${dashboardData.bills.length} vendor bills`,
          trend: billTotal > 0 ? "neutral" : "down",
          detail: "Supplier obligations currently in the database",
        },
        {
          label: "Journal approvals",
          value: formatCompactNumber(pendingJournalEntries.length),
          delta: `${postedJournalEntries.length + dashboardData.accountingJournals.length} posted`,
          trend: pendingJournalEntries.length > 0 ? "down" : "up",
          detail: "Approval-aware journals still waiting on finance action",
        },
        {
          label: "Open periods",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Posting windows available for the active company",
        },
      ],
      accountant: [
        {
          label: "Draft journals",
          value: formatCompactNumber(draftJournalEntries.length),
          delta: `${pendingJournalEntries.length} pending approval`,
          trend: draftJournalEntries.length > 0 ? "neutral" : "up",
          detail: "Workflow journals still awaiting validation or submission",
        },
        {
          label: "Posted journals",
          value: formatCompactNumber(postedJournalEntries.length + dashboardData.accountingJournals.length),
          delta: `${dashboardData.journalEntries.length} workflow entries`,
          trend: postedJournalEntries.length > 0 ? "up" : "neutral",
          detail: "General ledger activity already committed to the books",
        },
        {
          label: "Receivables billed",
          value: formatCurrency(invoiceTotal),
          delta: `${dashboardData.invoices.length} sales docs`,
          trend: invoiceTotal > 0 ? "up" : "neutral",
          detail: "Customer billing now visible from live invoice rows",
        },
        {
          label: "Open periods",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Close and posting readiness from fiscal year controls",
        },
      ],
      procurement: [
        {
          label: "Suppliers",
          value: formatCompactNumber(dashboardData.suppliers.length),
          delta: `${dashboardData.taxConfigs.length} tax codes`,
          trend: dashboardData.suppliers.length > 0 ? "up" : "down",
          detail: "Vendor records available for live procurement processing",
        },
        {
          label: "Vendor bills",
          value: formatCurrency(billTotal),
          delta: `${dashboardData.bills.length} documents`,
          trend: billTotal > 0 ? "up" : "neutral",
          detail: "Committed procurement spend already persisted",
        },
        {
          label: "Items ready",
          value: formatCompactNumber(dashboardData.products.length),
          delta: `${dashboardData.warehouses.length} warehouses`,
          trend: dashboardData.products.length > 0 ? "up" : "down",
          detail: "Product and warehouse setup feeding downstream purchase flow",
        },
        {
          label: "Stock handoffs",
          value: formatCompactNumber(dashboardData.movements.length),
          delta: `${dashboardData.bills.length} bills linked downstream`,
          trend: dashboardData.movements.length > 0 ? "up" : "neutral",
          detail: "Inventory movement signals following procurement activity",
        },
      ],
      inventory: [
        {
          label: "Items",
          value: formatCompactNumber(dashboardData.products.length),
          delta: `${dashboardData.warehouses.length} warehouses`,
          trend: dashboardData.products.length > 0 ? "up" : "down",
          detail: "Stock master records available to transact against",
        },
        {
          label: "Movements",
          value: formatCompactNumber(dashboardData.movements.length),
          delta: `${dashboardData.bills.length} upstream bills`,
          trend: dashboardData.movements.length > 0 ? "up" : "neutral",
          detail: "Receipts and issues now derived from live stock rows",
        },
        {
          label: "Connected suppliers",
          value: formatCompactNumber(dashboardData.suppliers.length),
          delta: `${dashboardData.bills.length} procurement docs`,
          trend: dashboardData.suppliers.length > 0 ? "up" : "neutral",
          detail: "Supplier readiness affecting inbound stock operations",
        },
        {
          label: "Open periods",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Posting windows available before stock-ledger handoff",
        },
      ],
      hr: [
        {
          label: "Payroll journals",
          value: formatCompactNumber(
            dashboardData.journalEntries.filter((entry) => entry.sourceModule?.toLowerCase().includes("payroll")).length,
          ),
          delta: `${pendingJournalEntries.length} finance approvals`,
          trend: pendingJournalEntries.length > 0 ? "neutral" : "up",
          detail: "Live payroll-linked journal records currently on the books",
        },
        {
          label: "Active users",
          value: formatCompactNumber(activeUsers),
          delta: `${dashboardData.users.length} total profiles`,
          trend: activeUsers > 0 ? "up" : "neutral",
          detail: "System access footprint across all registered users",
        },
        {
          label: "Open periods",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Payroll posting depends on open accounting periods",
        },
        {
          label: "Tax mappings",
          value: formatCompactNumber(dashboardData.taxConfigs.length),
          delta: `${dashboardData.customers.length} customers`,
          trend: dashboardData.taxConfigs.length > 0 ? "up" : "neutral",
          detail: "Tax configurations mapped to customers and GL accounts",
        },
      ],
      admin: [
        {
          label: "Active users",
          value: formatCompactNumber(activeUsers),
          delta: `${dashboardData.users.length} total users`,
          trend: activeUsers > 0 ? "up" : "down",
          detail: "Real access records loaded from the administration backend",
        },
        {
          label: "Open periods",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Period governance now comes from live fiscal year controls",
        },
        {
          label: "Journals awaiting action",
          value: formatCompactNumber(pendingJournalEntries.length),
          delta: `${draftJournalEntries.length} drafts in workflow`,
          trend: pendingJournalEntries.length > 0 ? "down" : "up",
          detail: "Approval-aware journals visible across the live finance engine",
        },
        {
          label: "Mapped tax codes",
          value: formatCompactNumber(dashboardData.taxConfigs.length),
          delta: `${dashboardData.suppliers.length} suppliers`,
          trend: dashboardData.taxConfigs.length > 0 ? "up" : "neutral",
          detail: "Configuration coverage available to finance and operations",
        },
      ],
      ceo: [
        {
          label: "Revenue billed",
          value: formatCurrency(invoiceTotal),
          delta: `${dashboardData.invoices.length} invoices`,
          trend: invoiceTotal > 0 ? "up" : "neutral",
          detail: "Commercial activity already captured in the system",
        },
        {
          label: "Committed spend",
          value: formatCurrency(billTotal),
          delta: `${dashboardData.bills.length} bills`,
          trend: billTotal > 0 ? "neutral" : "down",
          detail: "Procurement commitments flowing into finance",
        },
        {
          label: "Live stock movements",
          value: formatCompactNumber(dashboardData.movements.length),
          delta: `${dashboardData.products.length} tracked items`,
          trend: dashboardData.movements.length > 0 ? "up" : "neutral",
          detail: "Operational throughput across inventory touchpoints",
        },
        {
          label: "Open finance windows",
          value: formatCompactNumber(openPeriods),
          delta: currentFiscalYear?.name ?? "No current fiscal year",
          trend: openPeriods > 0 ? "up" : "down",
          detail: "Posting and reporting readiness for the active entity",
        },
      ],
    };

    const alerts: AlertItem[] = [];
    if (!currentFiscalYear || openPeriods === 0) {
      alerts.push({
        id: "periods-closed",
        title: "No open accounting period",
        detail: "Posting controls are currently closed or not configured for the active fiscal year.",
        severity: "critical",
        href: "/administration",
      });
    }
    if (pendingJournalEntries.length > 0) {
      alerts.push({
        id: "pending-journals",
        title: "Journal approvals waiting",
        detail: `${pendingJournalEntries.length} journal entries are still pending approval before they can hit the GL.`,
        severity: "warning",
        href: "/journal-entries",
      });
    }
    if ((role === "procurement" || role === "inventory" || role === "ceo") && dashboardData.products.length === 0) {
      alerts.push({
        id: "products-missing",
        title: "Item master is still empty",
        detail: "Products must exist before procurement, invoicing, and inventory handoffs behave like a connected process.",
        severity: "warning",
        href: "/inventory?view=Items",
      });
    }
    if ((role === "procurement" || role === "cfo" || role === "admin") && dashboardData.suppliers.length === 0) {
      alerts.push({
        id: "suppliers-missing",
        title: "Supplier setup is not ready",
        detail: "Live procurement data will stay thin until suppliers are created or imported into the database.",
        severity: "info",
        href: "/procurement?view=Suppliers",
      });
    }
    if ((role === "cfo" || role === "accountant" || role === "admin" || role === "ceo") && dashboardData.taxConfigs.length === 0) {
      alerts.push({
        id: "tax-setup",
        title: "Tax setup still needs mapping",
        detail: "Tax buckets and financial statements are cleaner when output and input tax codes are configured.",
        severity: "info",
        href: "/tax",
      });
    }
    if (role === "hr") {
      alerts.push({
        id: "hr-master-gap",
        title: "HR master tables are not fully wired yet",
        detail: "The dashboard is staying honest here: payroll and period readiness are live, but employee records still need backend mapping.",
        severity: "info",
        href: "/hr-payroll",
      });
    }
    if (loadNote) {
      alerts.push({
        id: "load-note",
        title: "Some dashboard feeds are partial",
        detail: loadNote,
        severity: "info",
        href: "/reports",
      });
    }

    const approvals: DashboardApproval[] = [
      ...pendingJournalEntries.slice(0, 4).map((entry) => ({
        id: `journal-${entry.id}`,
        label: entry.journalNumber,
        owner: entry.sourceModule ? `${entry.sourceModule} workflow` : "Finance approval queue",
        status: "Pending" as AppStatus,
        timestamp: formatTimestamp(entry.submittedAt ?? entry.updatedAt),
        kind: "journal" as const,
        journalId: entry.id,
      })),
      ...dashboardData.customers
        .filter((customer) => {
          const status = (customer.onboardingStatus ?? "").toLowerCase();
          return status === "pending" || status === "submitted";
        })
        .slice(0, 2)
        .map((customer) => ({
          id: `customer-${customer.id}`,
          label: customer.name,
          owner: "Customer onboarding",
          status: ((customer.onboardingStatus ?? "").toLowerCase() === "submitted" ? "Submitted" : "Pending") as AppStatus,
          kind: "customer" as const,
          customerId: customer.id,
        })),
    ];

    const timelineCandidates: Array<{ when: string; item: TimelineItem }> = [
      ...dashboardData.journalEntries.map((entry) => ({
        when: entry.updatedAt,
        item: {
          id: `je-${entry.id}`,
          title: entry.journalNumber,
          subtitle: entry.narration || entry.sourceDocumentNumber || "Journal workflow activity",
          timestamp: formatTimestamp(entry.updatedAt),
          user: entry.sourceModule ?? "Finance",
          status: normalizeStatus(entry.status),
        },
      })),
      ...dashboardData.accountingJournals.map((journal) => ({
        when: journal.updatedAt,
        item: {
          id: `gl-${journal.id}`,
          title: journal.reference,
          subtitle: journal.description || journal.type,
          timestamp: formatTimestamp(journal.updatedAt),
          user: "General Ledger",
          status: "Posted" as AppStatus,
        },
      })),
      ...dashboardData.invoices.map((invoice) => ({
        when: invoice.updatedAt,
        item: {
          id: `inv-${invoice.id}`,
          title: `Invoice ${invoice.number}`,
        subtitle: invoice.customer?.name ?? "Unmapped customer billing",
          timestamp: formatTimestamp(invoice.updatedAt),
          user: "Sales",
          status: normalizeStatus(invoice.status),
        },
      })),
      ...dashboardData.bills.map((bill) => ({
        when: bill.updatedAt,
        item: {
          id: `bill-${bill.id}`,
          title: `Bill ${bill.number}`,
          subtitle: bill.supplier?.name ?? "Vendor billing",
          timestamp: formatTimestamp(bill.updatedAt),
          user: "Procurement",
          status: normalizeStatus(bill.status),
        },
      })),
      ...dashboardData.movements.map((movement) => ({
        when: movement.createdAt,
        item: {
          id: `move-${movement.id}`,
          title: movement.direction === "IN" ? "Stock receipt" : "Stock issue",
          subtitle: `${movement.product?.name ?? "Item"} • ${movement.warehouse?.name ?? "Warehouse"}`,
          timestamp: formatTimestamp(movement.createdAt),
          user: "Inventory",
          status: "Posted" as AppStatus,
        },
      })),
      ...dashboardData.users.map((user) => ({
        when: user.updatedAt ?? user.createdAt ?? "",
        item: {
          id: `user-${user.id}`,
          title: user.isActive ? "User active" : "User archived",
          subtitle: user.email,
          timestamp: formatTimestamp(user.updatedAt ?? user.createdAt ?? ""),
          user: "Administration",
          status: (user.isActive ? "Approved" : "Archived") as AppStatus,
        },
      })),
    ];

    const timeline = timelineCandidates
      .filter((entry) => entry.when)
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 6)
      .map((entry) => entry.item);

    const trendSeed = [
      { label: "Journals", value: dashboardData.journalEntries.length + dashboardData.accountingJournals.length, href: "/journal-entries" },
      { label: "Sales", value: dashboardData.invoices.length, href: "/sales" },
      { label: "Purchases", value: dashboardData.bills.length, href: "/procurement" },
      { label: "Inventory", value: dashboardData.movements.length, href: "/inventory" },
      { label: "Customers", value: dashboardData.customers.length, href: "/crm" },
      { label: "Users", value: dashboardData.users.length, href: "/administration" },
    ];
    const trendMax = Math.max(...trendSeed.map((point) => point.value), 0);
    const trend = trendSeed.map((point) => ({
      ...point,
      percent: point.value > 0 && trendMax > 0 ? Math.max(20, Math.round((point.value / trendMax) * 100)) : 0,
    }));

    return {
      metrics: metricsByRole[role],
      alerts,
      approvals,
      timeline,
      trend,
    };
  }, [dashboardData, loadNote, role]);

  async function handleApproval(step: DashboardApproval, nextStatus: "Approved" | "Rejected") {
    if (!session?.token) {
      return;
    }

    setBusyApprovalId(step.id);
    try {
      if (step.kind === "journal" && step.journalId) {
        if (nextStatus === "Approved") {
          await approveJournalEntry(session.token, step.journalId, "Approved from dashboard");
        } else {
          await rejectJournalEntry(session.token, step.journalId, "Rejected from dashboard");
        }
      } else if (step.kind === "customer" && step.customerId) {
        await updateSalesCustomer(session.token, step.customerId, activeCompany!.id, {
          onboardingStatus: nextStatus.toUpperCase(),
        });
      }
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update the approval item.");
    } finally {
      setBusyApprovalId(null);
    }
  }

  const summary = `${getRoleLabel(role)} • ${activeCompany?.name ?? "No company selected"}${activeBranch ? ` • ${activeBranch.name}` : ""}`;

  return (
    <WorkspaceShell
      title="Dashboard"
      description={roleSummaryMap[role]}
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button
              className="primary-button"
              type="button"
              onClick={() => document.getElementById("dashboard-quick-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Open quick actions
            </button>
          }
          summary={summary}
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Review approvals",
                  description: "Jump to pending approvals in this dashboard",
                  onSelect: () => document.getElementById("dashboard-approvals")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Exceptions and alerts",
                  description: "Go straight to the exception queue",
                  onSelect: () => document.getElementById("dashboard-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Refresh live data",
                  description: "Reload the dashboard from the current source of truth",
                  onSelect: () => setRefreshNonce((current) => current + 1),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Business Intelligence", href: "/business-intelligence", description: "Live charts and executive insight" },
                { label: "Operational reports", href: "/reports", description: "Financial and operational reporting" },
              ],
            },
            {
              label: "More",
              items: [
                { label: "Administration", href: "/administration", description: "Governance and control center" },
                { label: "Journal entries", href: "/journal-entries", description: "Approval and posting workspace" },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {derivedDashboard.metrics.map((metric) => (
          <KpiCard
            key={metric.label}
            metric={loading && !workspaceLoading ? { ...metric, value: "Loading...", detail: "Refreshing live records..." } : metric}
            tone={roleToneMap[role]}
          />
        ))}
      </section>

      <section className="content-grid">
        <SectionCard title="Exceptions and alerts" eyebrow="Actions before charts">
          <div id="dashboard-alerts" />
          {derivedDashboard.alerts.length ? (
            <div className="alert-list">
              {derivedDashboard.alerts.map((alert) => (
                <article key={alert.id} className={`alert-row ${alert.severity}`}>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                  </div>
                  <button type="button" className="ghost-button small" onClick={() => router.push(alert.href ?? "/reports")}>
                    Drill down
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No urgent exceptions right now"
              body="The current company has no critical dashboard alerts from the live feeds that are mapped for your role."
              tone={roleToneMap[role] === "admin" ? "neutral" : roleToneMap[role]}
            />
          )}
        </SectionCard>
 
        <SectionCard title="Pending approvals" eyebrow="Approval queue">
          <div id="dashboard-approvals" />
          {derivedDashboard.approvals.length ? (
            <ApprovalStepper
              steps={derivedDashboard.approvals}
              busyId={busyApprovalId}
              onApprove={(step) => void handleApproval(step as DashboardApproval, "Approved")}
              onReject={(step) => void handleApproval(step as DashboardApproval, "Rejected")}
            />
          ) : (
            <EmptyState
              title="No pending approvals"
              body="Nothing is currently waiting in the live dashboard approval queue for this company and role."
              tone={roleToneMap[role] === "admin" ? "neutral" : roleToneMap[role]}
            />
          )}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Recent activity" eyebrow="Auditability visible">
          {derivedDashboard.timeline.length ? (
            <ActivityTimeline items={derivedDashboard.timeline} />
          ) : (
            <EmptyState
              title="No recent live activity"
              body="Once invoices, bills, journals, or stock movements are created, the dashboard activity feed will pick them up automatically."
              tone={roleToneMap[role] === "admin" ? "neutral" : roleToneMap[role]}
            />
          )}
        </SectionCard>

        <SectionCard title="Quick actions" eyebrow="Frequent work">
          <div id="dashboard-quick-actions" />
          <div className="action-stack">
            {roleQuickActions[role].map((action) => (
              <a key={action.label} href={action.href} className="action-card">
                <strong>{action.label}</strong>
                <span>{action.hint}</span>
              </a>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Live footprint" eyebrow="Current record volume">
        {derivedDashboard.trend.some((point) => point.value > 0) ? (
          <div className="trend-bars">
            {derivedDashboard.trend.map((point) => (
              <button key={point.label} type="button" className="trend-bar" onClick={() => router.push(point.href)}>
                <span>{point.label}</span>
                <div>
                  <i style={{ height: `${point.percent}%` }} />
                </div>
                <strong>{point.value}</strong>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No live footprint yet"
            body="Create records in the source modules and activity will appear here automatically."
            tone={roleToneMap[role] === "admin" ? "neutral" : roleToneMap[role]}
          />
        )}
      </SectionCard>
    </WorkspaceShell>
  );
}
