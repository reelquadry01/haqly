"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Bell, CalendarRange, Download, RefreshCw, Shield, Upload, UserCog } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { ApprovalStepper } from "../../components/ui/approval-stepper";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { RowActionMenu } from "../../components/ui/row-action-menu";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { administrationViews, roleOptions, type KpiMetric, type TimelineItem } from "../../lib/erp";
import {
  assignAdminRoles,
  closeFiscalYear,
  createAdminPermission,
  createAdminRole,
  createFiscalYear,
  createUser,
  getAccountingAccounts,
  getFiscalYears,
  getInventoryProducts,
  getPurchaseSuppliers,
  getSalesCustomers,
  getTaxConfigs,
  getUsers,
  importChartOfAccounts,
  importCustomers,
  importProducts,
  importSuppliers,
  importTaxConfigs,
  lockFiscalYear,
  updateAccountingPeriodStatus,
  updateCompany,
  updateUser,
  type BulkImportResponse,
  type FiscalYearRecord,
  type UserRecord,
} from "../../lib/api"
// NOTE: auto-patched by apply-admin-settings-api.ps1;
import { MfaSetup } from "../../components/mfa-setup";
import {
  coerceBoolean,
  coerceNumber,
  downloadImportTemplate,
  importTemplates,
  readCsvFile,
  type ImportDatasetKey,
} from "../../lib/import";

type Rule = { id: string; module: string; transaction: string; approvers: string; range: string; status: "Active" | "Draft" };
type ModuleToggle = { id: string; module: string; enabled: boolean; exportsAllowed: boolean; shortcut: string };
type Integration = { id: string; name: string; owner: string; status: "Healthy" | "Warning" | "Failed"; lastSync: string };
type FiscalYearForm = { name: string; startDate: string; endDate: string; generateMonthlyPeriods: boolean };
type AdminState = {
  rules: Rule[];
  modules: ModuleToggle[];
  integrations: Integration[];
  notifications: { email: boolean; inApp: boolean; escalation: boolean; failedLogin: boolean };
  security: { mfaAdmins: boolean; mfaApprovers: boolean; sessionTimeout: number; failedAttempts: number };
  numbering: { invoice: string; voucher: string; po: string; reset: "monthly" | "yearly" | "never" };
  companyProfile: { registeredName: string; taxId: string; timezone: string; baseCurrency: string };
};

const createDefaultAdminState = (companyName?: string): AdminState => ({
  rules: [],
  modules: [],
  integrations: [],
  notifications: { email: true, inApp: true, escalation: true, failedLogin: true },
  security: { mfaAdmins: true, mfaApprovers: true, sessionTimeout: 30, failedAttempts: 5 },
  numbering: { invoice: "INV-", voucher: "VCH-", po: "PO-", reset: "yearly" },
  companyProfile: { registeredName: companyName ?? "", taxId: "", timezone: "Africa/Lagos", baseCurrency: "NGN" },
});

const permissionTemplates = ["users:view", "users:create", "users:update", "admin:roles", "org:view", "org:create", "reports:export", "accounting:journal"];

const makePassword = () => `Tmp${Math.random().toString(36).slice(2, 8)}!9`;
const storeKey = (companyId?: number) => `haqly.admin.${companyId ?? "global"}`;
const shortDate = (value?: string | null) => (value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "-");
const isoDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const defaultFiscalYearDraft = (): FiscalYearForm => {
  const nextYear = new Date().getFullYear() + 1;
  return {
    name: `FY${nextYear}`,
    startDate: `${nextYear}-01-01`,
    endDate: `${nextYear}-12-31`,
    generateMonthlyPeriods: true,
  };
};
const fiscalYearStatusLabel: Record<FiscalYearRecord["status"], string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  LOCKED: "Locked",
};

export default function AdministrationPage() {
  const { session, activeCompany, activeBranch, refreshCompanies } = useWorkspace();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [message, setMessage] = useState("Administration changes are ready.");
  const [logoUrl, setLogoUrl] = useState("");
  const [state, setState] = useState<AdminState>(() => createDefaultAdminState());
  const [savingUser, setSavingUser] = useState(false);
  const [userDraft, setUserDraft] = useState({ firstName: "", lastName: "", email: "", password: makePassword(), role: "Admin" });
  const [roleDraft, setRoleDraft] = useState({ name: "", description: "", permissions: ["users:view", "org:view"] as string[] });
  const [permissionDraft, setPermissionDraft] = useState({ code: "", description: "" });
  const [approvalDraft, setApprovalDraft] = useState({ module: "Procurement", transaction: "Purchase Order", approvers: "HOD > Procurement Head", range: "0 - 500,000" });
  const [approvalQueue, setApprovalQueue] = useState<Array<{ id: string; label: string; owner: string; status: "Pending" | "Submitted" | "Approved" | "Rejected"; timestamp?: string }>>([]);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [importDataset, setImportDataset] = useState<ImportDatasetKey>("chart_of_accounts");
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRecord[]>([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<number | null>(null);
  const [fiscalYearDraft, setFiscalYearDraft] = useState<FiscalYearForm>(defaultFiscalYearDraft);
  const [loadingFiscalYears, setLoadingFiscalYears] = useState(false);
  const [savingFiscalYear, setSavingFiscalYear] = useState(false);

  useEffect(() => setLogoUrl(activeCompany?.logoUrl ?? ""), [activeCompany?.id, activeCompany?.logoUrl]);
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storeKey(activeCompany?.id)) : null;
    const baseState = createDefaultAdminState(activeCompany?.name);
    setState(raw ? { ...baseState, ...JSON.parse(raw) } : baseState);
  }, [activeCompany?.id, activeCompany?.name]);

  async function loadUserDirectory(token: string) {
    const data = await getUsers(token);
    setUsers(data);
    return data;
  }

  async function loadFiscalYearDirectory(token: string, companyId: number) {
    setLoadingFiscalYears(true);
    try {
      const data = await getFiscalYears(token, companyId);
      setFiscalYears(data);
      setSelectedFiscalYearId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return data.find((item) => item.isCurrent)?.id ?? data[0]?.id ?? null;
      });
      return data;
    } finally {
      setLoadingFiscalYears(false);
    }
  }

  useEffect(() => {
    if (!session?.token) return;
    loadUserDirectory(session.token).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load users."));
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || !activeCompany?.id) {
      setFiscalYears([]);
      setSelectedFiscalYearId(null);
      return;
    }
    loadFiscalYearDirectory(session.token, activeCompany.id).catch((error) =>
      setMessage(error instanceof Error ? error.message : "Could not load fiscal year controls."),
    );
  }, [activeCompany?.id, session?.token]);

  const metrics = useMemo<KpiMetric[]>(() => [
    { label: "Active users", value: String(users.filter((user) => user.isActive).length), delta: `${users.length} total`, trend: users.length ? "up" : "neutral", detail: "Live user directory from backend" },
    { label: "Approval rules", value: String(state.rules.length), delta: "Governance matrix", trend: "neutral", detail: "Approval controls configured" },
    { label: "Modules enabled", value: String(state.modules.filter((item) => item.enabled).length), delta: `${state.modules.filter((item) => item.exportsAllowed).length} export-enabled`, trend: "up", detail: "System behavior and visibility" },
    { label: "Admin insights", value: String(state.integrations.filter((item) => item.status !== "Healthy").length), delta: activeBranch?.name ?? "All branches", trend: state.integrations.some((item) => item.status === "Failed") ? "down" : "up", detail: "Integration and control warnings" },
  ], [activeBranch?.name, state.integrations, state.modules, state.rules.length, users]);

  const selectedFiscalYear = useMemo(
    () => fiscalYears.find((item) => item.id === selectedFiscalYearId) ?? fiscalYears[0] ?? null,
    [fiscalYears, selectedFiscalYearId],
  );

  const adminInsightRows = useMemo(
    () => [
      { label: "Active users", value: users.filter((user) => user.isActive).length, detail: "Live access records" },
      { label: "Inactive users", value: users.filter((user) => !user.isActive).length, detail: "Disabled logins" },
      { label: "Fiscal years", value: fiscalYears.length, detail: "Company period registers" },
      { label: "Browser-only controls", value: state.rules.length + state.modules.length + state.integrations.length, detail: "Local setup items pending backend tables" },
    ],
    [fiscalYears.length, state.integrations.length, state.modules.length, state.rules.length, users],
  );

  const adminAlerts = useMemo(
    () =>
      [
        !activeCompany
          ? { id: "admin-company", title: "No active company selected", detail: "Pick a company before editing governance settings.", severity: "warning" as const }
          : null,
        users.some((user) => !user.isActive)
          ? { id: "admin-inactive-users", title: "Inactive users detected", detail: `${users.filter((user) => !user.isActive).length} login(s) are disabled in the live directory.`, severity: "info" as const }
          : null,
        fiscalYears.length === 0
          ? { id: "admin-fiscal-years", title: "No fiscal years configured", detail: "Create a fiscal year so posting periods can be controlled from Administration.", severity: "warning" as const }
          : null,
        state.rules.length > 0
          ? { id: "admin-local-rules", title: "Approval rules are browser-only", detail: "Current approval matrix rows are not persisted to the database yet.", severity: "warning" as const }
          : null,
      ].filter(Boolean) as Array<{ id: string; title: string; detail: string; severity: "critical" | "warning" | "info" }>,
    [activeCompany, fiscalYears.length, state.rules.length, users],
  );

  const adminTimeline = useMemo<TimelineItem[]>(
    () => [
      ...users
        .filter((user) => user.updatedAt || user.createdAt)
        .slice(0, 3)
        .map((user) => ({
          id: `user-${user.id}`,
          title: user.isActive ? "User active" : "User disabled",
          subtitle: user.email,
          timestamp: shortDate(user.updatedAt ?? user.createdAt),
          user: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
          status: (user.isActive ? "Approved" : "Archived") as "Approved" | "Archived",
        })),
      ...(selectedFiscalYear
        ? [
            {
              id: `fy-${selectedFiscalYear.id}`,
              title: "Fiscal year in focus",
              subtitle: selectedFiscalYear.name,
              timestamp: shortDate(selectedFiscalYear.endDate),
              user: activeCompany?.name ?? "Current company",
              status:
                selectedFiscalYear.status === "OPEN"
                  ? "Approved"
                  : selectedFiscalYear.status === "CLOSED"
                    ? "Closed"
                    : "Archived",
            } satisfies TimelineItem,
          ]
        : []),
    ],
    [activeCompany?.name, selectedFiscalYear, users],
  );

  const userRows = users.map((user) => ({
    id: String(user.id),
    backendId: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User record",
    email: user.email,
    status: user.isActive ? "Approved" : "Archived",
    lastActivity: shortDate(user.updatedAt ?? user.createdAt),
    rawLastActivity: user.updatedAt ?? user.createdAt,
  }));
  function persist(nextState: AdminState, nextMessage: string) {
    setState(nextState);
    if (typeof window !== "undefined") window.localStorage.setItem(storeKey(activeCompany?.id), JSON.stringify(nextState));
    setMessage(nextMessage);
  }

  async function verifyImportFromSource(token: string, dataset: ImportDatasetKey) {
    switch (dataset) {
      case "chart_of_accounts": {
        const accounts = await getAccountingAccounts(token);
        return `${accounts.length} accounts now exist in the live chart of accounts.`;
      }
      case "customers": {
        if (!activeCompany?.id) {
          return "Customer import completed and the active company context was not available for a follow-up verification count.";
        }
        const customers = await getSalesCustomers(token, activeCompany.id);
        return `${customers.length} customers now exist in the live customer master for the active company.`;
      }
      case "suppliers": {
        if (!activeCompany?.id) {
          return "Supplier import completed and the active company context was not available for a follow-up verification count.";
        }
        const suppliers = await getPurchaseSuppliers(token, activeCompany.id);
        return `${suppliers.length} suppliers now exist in the live supplier master for the active company.`;
      }
      case "products": {
        if (!activeCompany?.id) {
          return "Product import completed and the active company context was not available for a follow-up verification count.";
        }
        const products = await getInventoryProducts(token, activeCompany.id);
        return `${products.length} products now exist in the live item master for the active company.`;
      }
      case "tax_codes": {
        if (!activeCompany?.id) {
          return "Tax import completed and the active company context was not available for a follow-up verification count.";
        }
        const configs = await getTaxConfigs(token, activeCompany.id);
        return `${configs.length} tax rules now exist for the active company.`;
      }
      default:
        return "Import committed successfully.";
    }
  }

  async function saveCompanyProfile() {
    if (!session?.token || !activeCompany) return setMessage("Choose an active company first.");
    try {
      await updateCompany(session.token, activeCompany.id, {
        name: state.companyProfile.registeredName.trim() || activeCompany.name,
        legalName: state.companyProfile.registeredName.trim() || undefined,
        taxId: state.companyProfile.taxId.trim() || undefined,
        timezone: state.companyProfile.timezone.trim() || undefined,
        currencyCode: state.companyProfile.baseCurrency.trim() || undefined,
        logoUrl: logoUrl || undefined,
      });
      await refreshCompanies();
      persist(state, "Company profile saved to the ERP database.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save company profile.");
    }
  }

  async function handleCreateFiscalYear() {
    if (!session?.token || !activeCompany?.id) return setMessage("Choose an active company first.");
    if (!fiscalYearDraft.name.trim() || !fiscalYearDraft.startDate || !fiscalYearDraft.endDate) {
      return setMessage("Enter a fiscal year name, start date, and end date.");
    }

    setSavingFiscalYear(true);
    try {
      const created = await createFiscalYear(session.token, {
        companyId: activeCompany.id,
        name: fiscalYearDraft.name.trim(),
        startDate: fiscalYearDraft.startDate,
        endDate: fiscalYearDraft.endDate,
        generateMonthlyPeriods: fiscalYearDraft.generateMonthlyPeriods,
      });
      const refreshed = await loadFiscalYearDirectory(session.token, activeCompany.id);
      setSelectedFiscalYearId(created.id);
      setFiscalYearDraft(defaultFiscalYearDraft());
      setMessage(
        `${created.name} was created and ${created.periods.length} accounting period(s) are now available in the live fiscal-year register (${refreshed.length} fiscal year(s) total).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create fiscal year.");
    } finally {
      setSavingFiscalYear(false);
    }
  }

  async function handleFiscalYearClose(fiscalYearId: number, fiscalYearName: string) {
    if (!session?.token || !activeCompany?.id) return;
    setSavingFiscalYear(true);
    try {
      await closeFiscalYear(session.token, fiscalYearId, `Closed from Administration by ${session.userName || session.userEmail}`);
      await loadFiscalYearDirectory(session.token, activeCompany.id);
      setMessage(`${fiscalYearName} has been closed and the fiscal-year register has been refreshed from the ERP database.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not close ${fiscalYearName}.`);
    } finally {
      setSavingFiscalYear(false);
    }
  }

  async function handleFiscalYearLock(fiscalYearId: number, fiscalYearName: string) {
    if (!session?.token || !activeCompany?.id) return;
    setSavingFiscalYear(true);
    try {
      await lockFiscalYear(session.token, fiscalYearId, `Locked from Administration by ${session.userName || session.userEmail}`);
      await loadFiscalYearDirectory(session.token, activeCompany.id);
      setMessage(`${fiscalYearName} is now locked. All periods are read-only and the live fiscal-year register has been refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not lock ${fiscalYearName}.`);
    } finally {
      setSavingFiscalYear(false);
    }
  }

  async function handlePeriodStatusChange(
    periodId: number,
    status: "OPEN" | "CLOSED" | "LOCKED",
    periodName: string,
  ) {
    if (!session?.token || !activeCompany?.id) return;
    setSavingFiscalYear(true);
    try {
      await updateAccountingPeriodStatus(session.token, periodId, { status });
      await loadFiscalYearDirectory(session.token, activeCompany.id);
      setMessage(`${periodName} was set to ${status.toLowerCase()} and the live fiscal-year register has been refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not update ${periodName}.`);
    } finally {
      setSavingFiscalYear(false);
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(typeof reader.result === "string" ? reader.result : "");
      setMessage("Logo loaded. Save company profile to apply it.");
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateUser() {
    if (!session?.token || !userDraft.firstName.trim() || !userDraft.email.trim()) return setMessage("Enter at least first name and email for the new user.");
    setSavingUser(true);
    try {
      const password = userDraft.password;
      const role = userDraft.role;
      const created = await createUser(session.token, { email: userDraft.email.trim(), password, firstName: userDraft.firstName.trim(), lastName: userDraft.lastName.trim() || undefined, isActive: true });
      await assignAdminRoles(session.token, created.id, [role]);
      await loadUserDirectory(session.token);
      setUserDraft({ firstName: "", lastName: "", email: "", password: makePassword(), role: "Admin" });
      setMessage(`User created, role assigned, and the live user directory has been refreshed. Temporary password: ${password}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create user.");
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUser(userId: number, active: boolean) {
    if (!session?.token) return;
    const target = users.find((user) => user.id === userId);
    setSavingUser(true);
    try {
      await updateUser(session.token, userId, { firstName: target?.firstName ?? undefined, lastName: target?.lastName ?? undefined, isActive: active });
      await loadUserDirectory(session.token);
      setMessage(active ? "User activated and the directory has been refreshed." : "User deactivated and the directory has been refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update user.");
    } finally {
      setSavingUser(false);
    }
  }

  async function assignRoleToUser(userId: number, userName: string) {
    if (!session?.token) return;
    setSavingUser(true);
    try {
      await assignAdminRoles(session.token, userId, [userDraft.role]);
      await loadUserDirectory(session.token);
      setMessage(`${userDraft.role} assigned to ${userName}. The live user directory has been refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not assign role.");
    } finally {
      setSavingUser(false);
    }
  }

  async function createRoleAndPermission() {
    if (!session?.token) return setMessage("Sign in again before creating roles.");
    try {
      if (roleDraft.name.trim()) await createAdminRole(session.token, { name: roleDraft.name.trim(), description: roleDraft.description || undefined, permissions: roleDraft.permissions });
      if (permissionDraft.code.trim()) await createAdminPermission(session.token, { code: permissionDraft.code.trim(), description: permissionDraft.description || undefined });
      setRoleDraft({ name: "", description: "", permissions: ["users:view", "org:view"] });
      setPermissionDraft({ code: "", description: "" });
      setMessage("Role and permission settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save role controls.");
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readCsvFile(file);
      setImportPreview(parsed.rows);
      setImportFileName(file.name);
      setImportResult(null);
      setMessage(`Loaded ${parsed.rows.length} row(s) from ${file.name}. Review and import when ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read import file.");
    }
  }

  async function handleImportRows() {
    if (!session?.token) return setMessage("Sign in again before importing data.");
    if (!importPreview.length) return setMessage("Load a CSV file first.");
    if (["customers", "suppliers", "products", "tax_codes"].includes(importDataset) && !activeCompany?.id) {
      return setMessage("Choose an active company before importing company-specific data.");
    }

    setImporting(true);
    setImportResult(null);

    try {
      const rows = importPreview.map((row) => {
        switch (importDataset) {
          case "chart_of_accounts":
            return {
              code: row.code,
              name: row.name,
              type: row.type,
              description: row.description || undefined,
              parentCode: row.parentCode || undefined,
              isActive: coerceBoolean(row.isActive || "true"),
              allowsPosting: coerceBoolean(row.allowsPosting || "true"),
              isControlAccount: coerceBoolean(row.isControlAccount || "false"),
              controlSource: row.controlSource || undefined,
            };
          case "customers":
          case "suppliers":
            return {
              name: row.name,
              email: row.email || undefined,
              phone: row.phone || undefined,
              line1: row.line1 || undefined,
              city: row.city || undefined,
              state: row.state || undefined,
              country: row.country || undefined,
              postalCode: row.postalCode || undefined,
            };
          case "products":
            return {
              sku: row.sku,
              name: row.name,
              category: row.category || undefined,
              uom: row.uom || undefined,
              isActive: coerceBoolean(row.isActive || "true"),
            };
          case "tax_codes":
            return {
              companyId: coerceNumber(row.companyId || String(activeCompany?.id ?? 0)),
              code: row.code,
              name: row.name,
              taxType: row.taxType || "VAT",
              rate: coerceNumber(row.rate),
              isInclusive: coerceBoolean(row.isInclusive || "false"),
              recoverable: coerceBoolean(row.recoverable || "false"),
              filingFrequency: row.filingFrequency || "MONTHLY",
              outputAccountCode: row.outputAccountCode || undefined,
              inputAccountCode: row.inputAccountCode || undefined,
              liabilityAccountCode: row.liabilityAccountCode || undefined,
            };
        }
      });

      const result =
        importDataset === "chart_of_accounts"
          ? await importChartOfAccounts(session.token, rows)
          : importDataset === "customers"
            ? await importCustomers(session.token, activeCompany!.id, rows)
            : importDataset === "suppliers"
              ? await importSuppliers(session.token, activeCompany!.id, rows)
              : importDataset === "products"
                ? await importProducts(session.token, activeCompany!.id, rows)
                : await importTaxConfigs(session.token, rows);

      setImportResult(result);
      const verification = await verifyImportFromSource(session.token, importDataset);
      setMessage(`Bulk import committed: ${result.created} created, ${result.updated} updated, ${result.failed} failed. ${verification}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete bulk import.");
    } finally {
      setImporting(false);
    }
  }

  function updateApprovalQueue(stepId: string, status: "Approved" | "Rejected") {
    setBusyApprovalId(stepId);
    setApprovalQueue((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status,
              timestamp: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date()),
            }
          : step,
      ),
    );
    setMessage(`Approval item ${status === "Approved" ? "approved" : "rejected"} in the admin queue.`);
    window.setTimeout(() => setBusyApprovalId(null), 250);
  }

  return (
    <WorkspaceShell
      title="Administration"
      description="The ERP control center for users, governance, approvals, security, integrations, numbering, and admin insights."
      requiredRoles={["admin", "cfo"]}
      tabs={administrationViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button with-icon" type="button" onClick={handleCreateUser} disabled={savingUser}>
              <UserCog size={16} /> {savingUser ? "Saving..." : "Create user"}
            </button>
          }
          summary="User creation stays visible. Governance, imports, branding, and integration controls are grouped into menus above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh users",
                  description: "Reload the live access directory",
                  onSelect: () => session?.token && loadUserDirectory(session.token).catch(() => {}),
                },
                {
                  label: "Refresh fiscal years",
                  description: "Reload live fiscal-year and period controls",
                  onSelect: () =>
                    session?.token &&
                    activeCompany?.id &&
                    loadFiscalYearDirectory(session.token, activeCompany.id).catch(() => {}),
                },
                {
                  label: "User management",
                  description: "Jump to the live user directory",
                  onSelect: () => document.getElementById("admin-users-section")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Setup",
              items: [
                {
                  label: "Company profile",
                  description: "Jump to branding and numbering controls",
                  onSelect: () => document.getElementById("admin-company-setup")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Approval matrix",
                  description: "Open approval workflow controls",
                  onSelect: () => document.getElementById("admin-approval-controls")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Fiscal year control",
                  description: "Open fiscal year and accounting period setup",
                  onSelect: () => document.getElementById("admin-fiscal-year-controls")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Tools",
              items: [
                {
                  label: "Bulk import tools",
                  description: "Jump to import/export controls",
                  onSelect: () => document.getElementById("admin-import-tools")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Integrations",
                  description: "Open integration health and sync monitoring",
                  onSelect: () => document.getElementById("admin-integrations")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">{metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="neutral" />)}</section>

      <section className="content-grid split-65">
        <SectionCard title="Admin insights" eyebrow="Analytics and control signals">
          {adminInsightRows.length ? (
            <div className="trend-bars">
              {adminInsightRows.map((point) => (
                <article key={point.label} className="trend-bar">
                  <strong>{point.label}</strong>
                  <div>
                    <i style={{ height: `${Math.min(100, Math.max(12, point.value * 12))}%` }} />
                  </div>
                  <span>{point.value} — {point.detail}</span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState tone="neutral" title="No live admin insights yet" body="Create users or fiscal years to populate live governance signals." />
          )}
        </SectionCard>
        <SectionCard title="Priority insights" eyebrow="Risk and adoption">
          <div className="alert-list compact">
            {adminAlerts.map((alert) => (
              <article key={alert.id} className={`alert-row ${alert.severity}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              </article>
            ))}
            <article className="alert-row info">
              <div>
                <strong>Branch context</strong>
                <p>{activeBranch ? `${activeBranch.name} is active for governance checks.` : "Select a branch to validate branch-based restrictions."}</p>
              </div>
            </article>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="User management" eyebrow="Live access directory">
          <div id="admin-users-section" />
          <DataTable title="Users" tableId="admin-users-live" exportFileName="admin-users" rows={userRows} searchValue={(row) => `${row.name} ${row.email} ${row.status}`} filters={[{ key: "active", label: "Active", predicate: (row) => row.status === "Approved" }, { key: "inactive", label: "Inactive", predicate: (row) => row.status === "Archived" }]} advancedFilters={[{ key: "userName", label: "User name", type: "text", getValue: (row) => row.name }, { key: "email", label: "Email", type: "text", getValue: (row) => row.email }, { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [{ value: "Approved", label: "Active" }, { value: "Archived", label: "Inactive" }] }, { key: "lastActivity", label: "Last activity", type: "date-range", getValue: (row) => row.rawLastActivity }]} bulkActions={["Export CSV", "Export Excel", "Export PDF"]} columns={[{ key: "name", label: "User", render: (row) => <div><strong>{row.name}</strong><p className="cell-subcopy">{row.email}</p></div>, exportValue: (row) => row.name }, { key: "lastActivity", label: "Last activity", render: (row) => row.lastActivity, exportValue: (row) => row.lastActivity }, { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status as "Approved" | "Archived"} />, exportValue: (row) => row.status }, { key: "actions", label: "Actions", render: (row) => <RowActionMenu label={`User actions for ${row.name}`} items={[{ label: `Assign ${userDraft.role}`, description: "Assign the selected role to this user", onSelect: () => assignRoleToUser(row.backendId, row.name), disabled: savingUser }, { label: row.status === "Approved" ? "Deactivate user" : "Activate user", description: "Update user access status", onSelect: () => toggleUser(row.backendId, row.status !== "Approved"), disabled: savingUser }]} />, exportValue: () => "Interactive controls" }]} />
        </SectionCard>
        <SectionCard title="Create user" eyebrow="User & access management">
          <div className="action-form-stack"><div className="form-grid two-up"><label className="field"><span>First name</span><input value={userDraft.firstName} onChange={(event) => setUserDraft((current) => ({ ...current, firstName: event.target.value }))} /></label><label className="field"><span>Last name</span><input value={userDraft.lastName} onChange={(event) => setUserDraft((current) => ({ ...current, lastName: event.target.value }))} /></label></div><div className="form-grid two-up"><label className="field"><span>Email</span><input value={userDraft.email} onChange={(event) => setUserDraft((current) => ({ ...current, email: event.target.value }))} /></label><label className="field"><span>Role</span><select className="select-input" value={userDraft.role} onChange={(event) => setUserDraft((current) => ({ ...current, role: event.target.value }))}><option>Admin</option><option>Accountant</option><option>Procurement Officer</option><option>Inventory Officer</option><option>HR Officer</option><option>CFO / Finance Director</option></select></label></div><label className="field"><span>Temporary password</span><div className="inline-actions"><input value={userDraft.password} onChange={(event) => setUserDraft((current) => ({ ...current, password: event.target.value }))} /><button className="ghost-button small" type="button" onClick={() => setUserDraft((current) => ({ ...current, password: makePassword() }))}>Regenerate</button></div></label></div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Roles, permissions, and company setup" eyebrow="Governance and enterprise setup">
          <div className="action-form-stack"><label className="field"><span>Role name</span><input value={roleDraft.name} onChange={(event) => setRoleDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Finance Approver" /></label><label className="field"><span>Role description</span><input value={roleDraft.description} onChange={(event) => setRoleDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Approves journals and vouchers above threshold" /></label><label className="field"><span>Permission matrix</span><div className="checklist">{permissionTemplates.map((permission) => <label key={permission}><input type="checkbox" checked={roleDraft.permissions.includes(permission)} onChange={() => setRoleDraft((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }))} /> {permission}</label>)}</div></label><label className="field"><span>Custom permission code</span><input value={permissionDraft.code} onChange={(event) => setPermissionDraft((current) => ({ ...current, code: event.target.value }))} placeholder="reports:configure" /></label><label className="field"><span>Permission description</span><input value={permissionDraft.description} onChange={(event) => setPermissionDraft((current) => ({ ...current, description: event.target.value }))} /></label><div className="inline-actions compact-end"><button className="primary-button" type="button" onClick={createRoleAndPermission}>Save role controls</button></div></div>
        </SectionCard>
        <SectionCard title="Organization setup & branding" eyebrow="Company profile and document controls">
          <div id="admin-company-setup" />
          <div className="action-form-stack"><div className="company-branding-preview">{logoUrl ? <img src={logoUrl} alt={`${activeCompany?.name ?? "Company"} logo`} className="company-logo-preview" /> : <div className="company-logo-placeholder">No logo</div>}<div><strong>{activeCompany?.name ?? "No active company selected"}</strong><p className="cell-subcopy">Update core identity, numbering, and statutory defaults here.</p></div></div><div className="form-grid two-up"><label className="field"><span>Registered name</span><input value={state.companyProfile.registeredName} onChange={(event) => setState((current) => ({ ...current, companyProfile: { ...current.companyProfile, registeredName: event.target.value } }))} /></label><label className="field"><span>Tax ID / TIN</span><input value={state.companyProfile.taxId} onChange={(event) => setState((current) => ({ ...current, companyProfile: { ...current.companyProfile, taxId: event.target.value } }))} /></label></div><div className="form-grid two-up"><label className="field"><span>Timezone</span><input value={state.companyProfile.timezone} onChange={(event) => setState((current) => ({ ...current, companyProfile: { ...current.companyProfile, timezone: event.target.value } }))} /></label><label className="field"><span>Base currency</span><input value={state.companyProfile.baseCurrency} onChange={(event) => setState((current) => ({ ...current, companyProfile: { ...current.companyProfile, baseCurrency: event.target.value } }))} /></label></div><label className="field"><span>Logo URL</span><input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label><label className="field"><span>Upload logo</span><input type="file" accept="image/*" onChange={handleLogoUpload} /></label><div className="form-grid two-up"><label className="field"><span>Invoice prefix</span><input value={state.numbering.invoice} onChange={(event) => setState((current) => ({ ...current, numbering: { ...current.numbering, invoice: event.target.value } }))} /></label><label className="field"><span>Voucher prefix</span><input value={state.numbering.voucher} onChange={(event) => setState((current) => ({ ...current, numbering: { ...current.numbering, voucher: event.target.value } }))} /></label></div><div className="inline-actions compact-end"><button className="primary-button" type="button" onClick={saveCompanyProfile}>Save company profile</button><button className="ghost-button" type="button" onClick={() => persist(state, "Browser-only admin preferences updated. They have not been written to the ERP database yet.")}>Save controls (browser only)</button></div></div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Fiscal years & accounting periods" eyebrow="Period governance">
          <div id="admin-fiscal-year-controls" />
          <div className="admin-fiscal-toolbar">
            <div>
              <strong>{selectedFiscalYear?.name ?? "No fiscal year configured"}</strong>
              <p className="cell-subcopy">Use these controls to govern posting windows. Closed and locked periods immediately affect journal and posting validation.</p>
            </div>
            <button
              className="ghost-button with-icon"
              type="button"
              onClick={() => session?.token && activeCompany?.id && loadFiscalYearDirectory(session.token, activeCompany.id).catch(() => {})}
              disabled={loadingFiscalYears}
            >
              <RefreshCw size={16} className={loadingFiscalYears ? "spin" : undefined} />
              {loadingFiscalYears ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingFiscalYears ? (
            <p className="note">Loading live fiscal-year controls…</p>
          ) : fiscalYears.length ? (
            <div className="admin-fiscal-grid">
              <div className="admin-fiscal-list">
                {fiscalYears.map((fiscalYear) => (
                  <article
                    key={fiscalYear.id}
                    className={`admin-fiscal-row${selectedFiscalYear?.id === fiscalYear.id ? " is-selected" : ""}${fiscalYear.isCurrent ? " is-current" : ""}`}
                    onClick={() => setSelectedFiscalYearId(fiscalYear.id)}
                  >
                    <div className="admin-fiscal-row-main">
                      <div className="admin-fiscal-row-title">
                        <strong>{fiscalYear.name}</strong>
                        {fiscalYear.isCurrent ? <span className="admin-fiscal-chip">Current</span> : null}
                      </div>
                      <p>{shortDate(fiscalYear.startDate)} - {shortDate(fiscalYear.endDate)}</p>
                    </div>
                    <div className="admin-fiscal-row-stats">
                      <span>Open {fiscalYear.counts.open}</span>
                      <span>Closed {fiscalYear.counts.closed}</span>
                      <span>Locked {fiscalYear.counts.locked}</span>
                    </div>
                    <span className={`admin-fiscal-status status-${fiscalYear.status.toLowerCase()}`}>{fiscalYearStatusLabel[fiscalYear.status]}</span>
                    <div className="admin-fiscal-row-actions">
                      {fiscalYear.status === "OPEN" ? (
                        <button
                          className="ghost-button small"
                          type="button"
                          disabled={savingFiscalYear}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFiscalYearClose(fiscalYear.id, fiscalYear.name);
                          }}
                        >
                          Close year
                        </button>
                      ) : null}
                      {fiscalYear.status === "CLOSED" ? (
                        <button
                          className="ghost-button small"
                          type="button"
                          disabled={savingFiscalYear}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFiscalYearLock(fiscalYear.id, fiscalYear.name);
                          }}
                        >
                          Lock
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="admin-fiscal-detail">
                {selectedFiscalYear ? (
                  <>
                    <div className="admin-fiscal-summary">
                      <div>
                        <span className="admin-fiscal-summary-label">Selected fiscal year</span>
                        <h3>{selectedFiscalYear.name}</h3>
                        <p>{shortDate(selectedFiscalYear.startDate)} - {shortDate(selectedFiscalYear.endDate)}</p>
                      </div>
                      <div className={`admin-fiscal-status status-${selectedFiscalYear.status.toLowerCase()}`}>{fiscalYearStatusLabel[selectedFiscalYear.status]}</div>
                    </div>

                    <div className="admin-fiscal-readiness">
                      <article>
                        <strong>{selectedFiscalYear.counts.open}</strong>
                        <span>Open periods</span>
                      </article>
                      <article>
                        <strong>{selectedFiscalYear.counts.closed}</strong>
                        <span>Closed periods</span>
                      </article>
                      <article>
                        <strong>{selectedFiscalYear.counts.locked}</strong>
                        <span>Locked periods</span>
                      </article>
                    </div>

                    <div className="admin-period-grid">
                      {selectedFiscalYear.periods.map((period) => (
                        <article key={period.id} className={`admin-period-card status-${period.status.toLowerCase()}`}>
                          <div className="admin-period-card-head">
                            <div>
                              <strong>{period.name}</strong>
                              <p>{shortDate(period.startDate)} - {shortDate(period.endDate)}</p>
                            </div>
                            <span className={`admin-fiscal-status status-${period.status.toLowerCase()}`}>{period.status}</span>
                          </div>
                          <div className="admin-period-card-actions">
                            {period.status !== "OPEN" ? (
                              <button
                                className="ghost-button small"
                                type="button"
                                disabled={savingFiscalYear || selectedFiscalYear.status === "LOCKED"}
                                onClick={() => handlePeriodStatusChange(period.id, "OPEN", period.name)}
                              >
                                Open
                              </button>
                            ) : null}
                            {period.status !== "CLOSED" ? (
                              <button
                                className="ghost-button small"
                                type="button"
                                disabled={savingFiscalYear || selectedFiscalYear.status === "LOCKED"}
                                onClick={() => handlePeriodStatusChange(period.id, "CLOSED", period.name)}
                              >
                                Close
                              </button>
                            ) : null}
                            {period.status !== "LOCKED" ? (
                              <button
                                className="ghost-button small"
                                type="button"
                                disabled={savingFiscalYear || selectedFiscalYear.status === "LOCKED"}
                                onClick={() => handlePeriodStatusChange(period.id, "LOCKED", period.name)}
                              >
                                Lock
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="note">Create a fiscal year to begin controlling accounting periods from Administration.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="note">No fiscal years exist for this company yet. Create the first year to enable period-based posting controls.</p>
          )}
        </SectionCard>

        <SectionCard title="Create fiscal year" eyebrow="Clean setup flow">
          <div className="action-form-stack">
            <div className="admin-fiscal-template-card">
              <div className="admin-fiscal-template-copy">
                <CalendarRange size={18} />
                <div>
                  <strong>Template-aligned fiscal year setup</strong>
                  <p className="cell-subcopy">This creates the fiscal year and, if selected, generates monthly accounting periods for posting, period close, and reporting.</p>
                </div>
              </div>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Fiscal year name</span>
                <input value={fiscalYearDraft.name} onChange={(event) => setFiscalYearDraft((current) => ({ ...current, name: event.target.value }))} placeholder="FY2027" />
              </label>
              <label className="field">
                <span>Generate monthly periods</span>
                <select
                  className="select-input"
                  value={fiscalYearDraft.generateMonthlyPeriods ? "yes" : "no"}
                  onChange={(event) =>
                    setFiscalYearDraft((current) => ({ ...current, generateMonthlyPeriods: event.target.value === "yes" }))
                  }
                >
                  <option value="yes">Yes - monthly periods</option>
                  <option value="no">No - year only</option>
                </select>
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Start date</span>
                <input type="date" value={fiscalYearDraft.startDate} onChange={(event) => setFiscalYearDraft((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label className="field">
                <span>End date</span>
                <input type="date" value={fiscalYearDraft.endDate} onChange={(event) => setFiscalYearDraft((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>

            <div className="admin-fiscal-readiness compact">
              <article>
                <strong>{fiscalYears.length}</strong>
                <span>Years configured</span>
              </article>
              <article>
                <strong>{selectedFiscalYear?.periods.length ?? 0}</strong>
                <span>Periods in focus</span>
              </article>
              <article>
                <strong>{activeCompany?.name ?? "No company"}</strong>
                <span>Company context</span>
              </article>
            </div>

            <div className="inline-actions compact-end">
              <button className="primary-button with-icon" type="button" onClick={handleCreateFiscalYear} disabled={savingFiscalYear}>
                <CalendarRange size={16} />
                {savingFiscalYear ? "Creating..." : "Create fiscal year"}
              </button>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Approval workflow, security, and module control" eyebrow="Control policies">
          <div id="admin-approval-controls" />
          <DataTable title="Approval matrix" tableId="admin-approval-matrix" exportFileName="admin-approval-matrix" rows={state.rules} searchValue={(row) => `${row.module} ${row.transaction} ${row.approvers}`} filters={[{ key: "active", label: "Active", predicate: (row) => row.status === "Active" }]} advancedFilters={[{ key: "module", label: "Module", type: "text", getValue: (row) => row.module }, { key: "transaction", label: "Transaction", type: "text", getValue: (row) => row.transaction }, { key: "approver", label: "Approver", type: "text", getValue: (row) => row.approvers }, { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [{ value: "Active", label: "Active" }, { value: "Draft", label: "Draft" }] }]} bulkActions={["Export CSV", "Export Excel", "Export PDF"]} columns={[{ key: "module", label: "Module", render: (row) => row.module, exportValue: (row) => row.module }, { key: "transaction", label: "Transaction", render: (row) => row.transaction, exportValue: (row) => row.transaction }, { key: "range", label: "Amount range", render: (row) => row.range, exportValue: (row) => row.range }, { key: "approvers", label: "Approvers", render: (row) => row.approvers, exportValue: (row) => row.approvers }, { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status === "Active" ? "Approved" : "Draft"} />, exportValue: (row) => row.status }]} />
          {approvalQueue.length ? (
            <ApprovalStepper
              steps={approvalQueue}
              busyId={busyApprovalId}
              onApprove={(step) => updateApprovalQueue(step.id, "Approved")}
              onReject={(step) => updateApprovalQueue(step.id, "Rejected")}
            />
          ) : (
            <EmptyState
              tone="neutral"
              title="No live approval queue mapped here"
              body="Approval queue rows are hidden until a backend approval feed is wired for Administration."
            />
          )}
          <div className="form-grid two-up"><label className="field"><span>Module</span><input value={approvalDraft.module} onChange={(event) => setApprovalDraft((current) => ({ ...current, module: event.target.value }))} /></label><label className="field"><span>Transaction</span><input value={approvalDraft.transaction} onChange={(event) => setApprovalDraft((current) => ({ ...current, transaction: event.target.value }))} /></label></div>
          <div className="form-grid two-up"><label className="field"><span>Range</span><input value={approvalDraft.range} onChange={(event) => setApprovalDraft((current) => ({ ...current, range: event.target.value }))} /></label><label className="field"><span>Approvers</span><input value={approvalDraft.approvers} onChange={(event) => setApprovalDraft((current) => ({ ...current, approvers: event.target.value }))} /></label></div>
          <div className="inline-actions compact-end"><button className="ghost-button" type="button" onClick={() => persist({ ...state, rules: [{ id: `APR-${Date.now()}`, module: approvalDraft.module, transaction: approvalDraft.transaction, approvers: approvalDraft.approvers, range: approvalDraft.range, status: "Active" }, ...state.rules] }, "Approval rule stored only in this browser session. It is not yet persisted to the ERP database.")}>Save locally (not yet in DB)</button></div>
        </SectionCard>
        <SectionCard title="Security, notifications, integrations, and audit" eyebrow="Policy visibility">
          <div id="admin-integrations" />
          <div className="mfa-setup-wrapper" style={{ marginBottom: "1.5rem" }}>
            {session?.token && (
              <MfaSetup token={session.token} apiBaseUrl="http://localhost:3000/api/v1" />
            )}
          </div>
          <div className="checklist"><label><input type="checkbox" checked={state.security.mfaAdmins} onChange={() => setState((current) => ({ ...current, security: { ...current.security, mfaAdmins: !current.security.mfaAdmins } }))} /> MFA for admins</label><label><input type="checkbox" checked={state.security.mfaApprovers} onChange={() => setState((current) => ({ ...current, security: { ...current.security, mfaApprovers: !current.security.mfaApprovers } }))} /> MFA for approvers</label><label><input type="checkbox" checked={state.notifications.email} onChange={() => setState((current) => ({ ...current, notifications: { ...current.notifications, email: !current.notifications.email } }))} /> Approval emails</label><label><input type="checkbox" checked={state.notifications.failedLogin} onChange={() => setState((current) => ({ ...current, notifications: { ...current.notifications, failedLogin: !current.notifications.failedLogin } }))} /> Failed login alerts</label></div>
          <div className="form-grid two-up"><label className="field"><span>Session timeout (mins)</span><input type="number" value={state.security.sessionTimeout} onChange={(event) => setState((current) => ({ ...current, security: { ...current.security, sessionTimeout: Number(event.target.value) } }))} /></label><label className="field"><span>Lock after failed attempts</span><input type="number" value={state.security.failedAttempts} onChange={(event) => setState((current) => ({ ...current, security: { ...current.security, failedAttempts: Number(event.target.value) } }))} /></label></div>
          <DataTable title="Module controls" tableId="admin-module-controls" exportFileName="admin-module-controls" rows={state.modules} searchValue={(row) => `${row.module} ${row.shortcut}`} filters={[{ key: "enabled", label: "Enabled", predicate: (row) => row.enabled }]} advancedFilters={[{ key: "module", label: "Module", type: "text", getValue: (row) => row.module }, { key: "shortcut", label: "Shortcut", type: "text", getValue: (row) => row.shortcut }, { key: "enabled", label: "Enabled", type: "select", getValue: (row) => (row.enabled ? "yes" : "no"), options: [{ value: "yes", label: "Enabled" }, { value: "no", label: "Disabled" }] }, { key: "exportsAllowed", label: "Export rights", type: "select", getValue: (row) => (row.exportsAllowed ? "yes" : "no"), options: [{ value: "yes", label: "Allowed" }, { value: "no", label: "Blocked" }] }]} bulkActions={["Export CSV", "Export Excel", "Export PDF"]} columns={[{ key: "module", label: "Module", render: (row) => <strong>{row.module}</strong>, exportValue: (row) => row.module }, { key: "shortcut", label: "Shortcut", render: (row) => row.shortcut, exportValue: (row) => row.shortcut }, { key: "enabled", label: "Enabled", render: (row) => <StatusBadge status={row.enabled ? "Approved" : "Archived"} />, exportValue: (row) => row.enabled ? "Yes" : "No" }, { key: "exportsAllowed", label: "Export", render: (row) => <StatusBadge status={row.exportsAllowed ? "Approved" : "Archived"} />, exportValue: (row) => row.exportsAllowed ? "Yes" : "No" }]} />
          <DataTable title="Integrations" tableId="admin-integrations" exportFileName="admin-integrations" rows={state.integrations} searchValue={(row) => `${row.name} ${row.owner} ${row.status}`} filters={[{ key: "attention", label: "Needs attention", predicate: (row) => row.status !== "Healthy" }]} advancedFilters={[{ key: "integration", label: "Integration", type: "text", getValue: (row) => row.name }, { key: "owner", label: "Owner", type: "text", getValue: (row) => row.owner }, { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [{ value: "Healthy", label: "Healthy" }, { value: "Warning", label: "Warning" }, { value: "Failed", label: "Failed" }] }, { key: "lastSync", label: "Last sync", type: "text", getValue: (row) => row.lastSync }]} bulkActions={["Export CSV", "Export Excel", "Export PDF"]} columns={[{ key: "name", label: "Integration", render: (row) => <strong>{row.name}</strong>, exportValue: (row) => row.name }, { key: "owner", label: "Owner", render: (row) => row.owner, exportValue: (row) => row.owner }, { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status === "Healthy" ? "Approved" : row.status === "Warning" ? "Pending" : "Rejected"} />, exportValue: (row) => row.status }, { key: "lastSync", label: "Last sync", render: (row) => row.lastSync, exportValue: (row) => row.lastSync }]} />
          <div className="inline-actions compact-end"><button className="ghost-button with-icon" type="button" onClick={() => persist(state, "Security settings stored only in this browser. Database persistence is not wired for this section yet.")}><Shield size={16} /> Save locally (not yet in DB)</button><button className="ghost-button with-icon" type="button" onClick={() => persist(state, "Notification settings stored only in this browser. Database persistence is not wired for this section yet.")}><Bell size={16} /> Save locally (not yet in DB)</button></div>
          {adminTimeline.length ? (
            <ActivityTimeline items={adminTimeline} />
          ) : (
            <EmptyState tone="neutral" title="No live audit highlights yet" body="Recent user and fiscal-year changes will appear here when they exist in the database." />
          )}
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Import / Export tools" eyebrow="Bulk data migration">
          <div id="admin-import-tools" />
          <div className="action-form-stack">
            <div className="form-grid two-up">
              <label className="field">
                <span>Dataset</span>
                <select className="select-input" value={importDataset} onChange={(event) => setImportDataset(event.target.value as ImportDatasetKey)}>
                  {Object.entries(importTemplates).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Upload CSV</span>
                <input type="file" accept=".csv,text/csv" onChange={handleImportFile} />
              </label>
            </div>
            <div className="inline-actions compact-end">
              <button className="ghost-button with-icon" type="button" onClick={() => downloadImportTemplate(importDataset)}>
                <Download size={16} />
                Download template
              </button>
              <button className="primary-button with-icon" type="button" onClick={handleImportRows} disabled={importing || !importPreview.length}>
                <Upload size={16} />
                {importing ? "Importing..." : "Run bulk import"}
              </button>
            </div>
            <p className="note">
              {importFileName
                ? `Loaded ${importPreview.length} row(s) from ${importFileName}.`
                : "Use templates for Chart of Accounts, Customers, Suppliers, Products, and Tax Codes. Tax code imports should use the active company's ID where appropriate."}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Import preview and results" eyebrow="Validation summary">
          {importPreview.length ? (
            <DataTable
              title="Preview"
              tableId="admin-import-preview"
              exportFileName="import-preview"
              rows={importPreview.slice(0, 10).map((row, index) => ({ id: String(index + 1), ...row }))}
              searchValue={(row) => Object.values(row).join(" ")}
              bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
              columns={importTemplates[importDataset].headers.slice(0, 6).map((header) => ({
                key: header,
                label: header,
                render: (row: Record<string, string>) => row[header] || "-",
                exportValue: (row: Record<string, string>) => row[header] || "",
              }))}
            />
          ) : (
            <p className="note">No file loaded yet. Download a template, fill it, then upload it here for bulk import.</p>
          )}

          {importResult ? (
            <div className="alert-list compact">
              <article className="alert-row info">
                <div>
                  <strong>Import summary</strong>
                  <p>
                    {importResult.created} created, {importResult.updated} updated, {importResult.failed} failed.
                  </p>
                </div>
              </article>
              {importResult.errors.slice(0, 5).map((error) => (
                <article key={`${error.row}-${error.message}`} className="alert-row warning">
                  <div>
                    <strong>Row {error.row}</strong>
                    <p>{error.message}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </section>

      {message ? <div className="banner warning">{message}</div> : null}
    </WorkspaceShell>
  );
}



