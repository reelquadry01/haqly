"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CopyPlus, FileSpreadsheet, Plus, Settings2, Warehouse } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { RowActionMenu } from "../../components/ui/row-action-menu";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { createBranch, createCompany, cloneCompany, getCompanies, updateCompany, type CompanyRecord } from "../../lib/api";
import { downloadCsvFile } from "../../lib/export";
import { useWorkspace } from "../../hooks/use-workspace";

type CompanyForm = {
  name: string;
  legalName: string;
  code: string;
  registrationNumber: string;
  taxId: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  currencyCode: string;
  timezone: string;
  fiscalYearStartMonth: string;
  isActive: boolean;
  useBranches: boolean;
  useInventory: boolean;
  usePayroll: boolean;
  useDepartments: boolean;
  logoUrl: string;
  defaultBranchName: string;
  defaultBranchCode: string;
};

const companyStatusText = (isActive?: boolean) => (isActive === false ? "Archived" : "Approved");

function emptyCompanyForm(): CompanyForm {
  return {
    name: "",
    legalName: "",
    code: "",
    registrationNumber: "",
    taxId: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "Nigeria",
    currencyCode: "NGN",
    timezone: "Africa/Lagos",
    fiscalYearStartMonth: "1",
    isActive: true,
    useBranches: true,
    useInventory: true,
    usePayroll: false,
    useDepartments: true,
    logoUrl: "",
    defaultBranchName: "Head Office",
    defaultBranchCode: "",
  };
}

function formFromCompany(company: CompanyRecord): CompanyForm {
  return {
    name: company.name ?? "",
    legalName: company.legalName ?? company.name ?? "",
    code: company.code ?? "",
    registrationNumber: company.registrationNumber ?? "",
    taxId: company.taxId ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    addressLine1: company.addressLine1 ?? "",
    addressLine2: company.addressLine2 ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    country: company.country ?? "Nigeria",
    currencyCode: company.currency?.code ?? "NGN",
    timezone: company.timezone ?? "Africa/Lagos",
    fiscalYearStartMonth: String(company.fiscalYearStartMonth ?? 1),
    isActive: company.isActive !== false,
    useBranches: company.useBranches !== false,
    useInventory: company.useInventory !== false,
    usePayroll: company.usePayroll === true,
    useDepartments: company.useDepartments !== false,
    logoUrl: company.logoUrl ?? "",
    defaultBranchName: company.branches[0]?.name ?? "Head Office",
    defaultBranchCode: company.branches[0]?.code ?? "",
  };
}

export default function OrganizationsPage() {
  const { session, activeCompany, refreshCompanies } = useWorkspace();
  const [directoryCompanies, setDirectoryCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneCode, setCloneCode] = useState("");
  const [message, setMessage] = useState(
    "Create a new company from Administration/Setup, then continue with branch, user, chart of accounts, and tax setup.",
  );
  const [saving, setSaving] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const selectedCompany = useMemo(
    () => directoryCompanies.find((company) => company.id === selectedCompanyId) ?? null,
    [directoryCompanies, selectedCompanyId],
  );

  async function loadCompanyDirectory() {
    if (!session?.token) {
      setDirectoryCompanies([]);
      return;
    }

    setLoadingDirectory(true);
    try {
      const records = await getCompanies(session.token, { includeInactive: true });
      setDirectoryCompanies(records);
      setSelectedCompanyId((current) => current ?? records[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the company directory.");
    } finally {
      setLoadingDirectory(false);
    }
  }

  useEffect(() => {
    void loadCompanyDirectory();
  }, [session?.token]);

  useEffect(() => {
    if (selectedCompany) {
      setCompanyForm(formFromCompany(selectedCompany));
    } else if (!selectedCompanyId) {
      setCompanyForm(emptyCompanyForm());
    }
  }, [selectedCompany, selectedCompanyId]);

  const companyRows = useMemo(
    () =>
      directoryCompanies.map((company) => ({
        id: String(company.id),
        companyId: company.id,
        name: company.name,
        code: company.code ?? "-",
        legalName: company.legalName ?? company.name,
        currencyCode: company.currency?.code ?? "NGN",
        status: companyStatusText(company.isActive),
        branches: company.branches.length,
        branchNames: company.branches.map((branch) => branch.name).join(", ") || "No branches",
        fiscalYear: company.fiscalYears?.[0]?.name ?? "Not configured",
      })),
    [directoryCompanies],
  );

  const nextSteps = selectedCompany
    ? [
        { label: "Add Branch", hint: "Extend locations and operational coverage", action: () => document.getElementById("branch-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        { label: "Assign Users", hint: "Provision access in Administration", href: "/administration?view=Users" },
        { label: "Configure COA", hint: "Set up ledger structure", href: "/finance" },
        { label: "Configure Tax", hint: "Map VAT and statutory settings", href: "/tax" },
      ]
    : [];

  async function reloadAfterChange(nextMessage: string, focusCompanyId?: number) {
    await refreshCompanies();
    await loadCompanyDirectory();
    if (focusCompanyId) {
      setSelectedCompanyId(focusCompanyId);
    }
    setMessage(nextMessage);
  }

  async function handleCreateCompany() {
    if (!session?.token) {
      return;
    }
    if (!companyForm.name.trim() || !companyForm.code.trim()) {
      setMessage("Enter at least the company name and company code.");
      return;
    }

    setSaving(true);
    try {
      const created = await createCompany(session.token, {
        name: companyForm.name.trim(),
        legalName: companyForm.legalName.trim() || companyForm.name.trim(),
        code: companyForm.code.trim(),
        registrationNumber: companyForm.registrationNumber.trim() || undefined,
        taxId: companyForm.taxId.trim() || undefined,
        email: companyForm.email.trim() || undefined,
        phone: companyForm.phone.trim() || undefined,
        addressLine1: companyForm.addressLine1.trim() || undefined,
        addressLine2: companyForm.addressLine2.trim() || undefined,
        city: companyForm.city.trim() || undefined,
        state: companyForm.state.trim() || undefined,
        country: companyForm.country.trim() || undefined,
        currencyCode: companyForm.currencyCode.trim() || "NGN",
        timezone: companyForm.timezone.trim() || "Africa/Lagos",
        fiscalYearStartMonth: Number(companyForm.fiscalYearStartMonth || "1"),
        isActive: companyForm.isActive,
        useBranches: companyForm.useBranches,
        useInventory: companyForm.useInventory,
        usePayroll: companyForm.usePayroll,
        useDepartments: companyForm.useDepartments,
        logoUrl: companyForm.logoUrl.trim() || undefined,
        defaultBranchName: companyForm.defaultBranchName.trim() || "Head Office",
        defaultBranchCode: companyForm.defaultBranchCode.trim() || undefined,
      });
      await reloadAfterChange(
        `${created.name} was created, added to the company selector, and bootstrapped with a default branch, fiscal year, periods, and numbering sequences.`,
        created.id,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create company.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCompany() {
    if (!session?.token || !selectedCompany) {
      setMessage("Choose a company from the directory first.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCompany(session.token, selectedCompany.id, {
        name: companyForm.name.trim() || undefined,
        legalName: companyForm.legalName.trim() || undefined,
        code: companyForm.code.trim() || undefined,
        registrationNumber: companyForm.registrationNumber.trim() || undefined,
        taxId: companyForm.taxId.trim() || undefined,
        email: companyForm.email.trim() || undefined,
        phone: companyForm.phone.trim() || undefined,
        addressLine1: companyForm.addressLine1.trim() || undefined,
        addressLine2: companyForm.addressLine2.trim() || undefined,
        city: companyForm.city.trim() || undefined,
        state: companyForm.state.trim() || undefined,
        country: companyForm.country.trim() || undefined,
        currencyCode: companyForm.currencyCode.trim() || undefined,
        timezone: companyForm.timezone.trim() || undefined,
        fiscalYearStartMonth: Number(companyForm.fiscalYearStartMonth || "1"),
        isActive: companyForm.isActive,
        useBranches: companyForm.useBranches,
        useInventory: companyForm.useInventory,
        usePayroll: companyForm.usePayroll,
        useDepartments: companyForm.useDepartments,
        logoUrl: companyForm.logoUrl.trim() || undefined,
      });
      await reloadAfterChange(`${updated.name} settings were saved and reloaded from the database.`, updated.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update company.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCompanyStatus(nextActive: boolean) {
    if (!session?.token || !selectedCompany) {
      setMessage("Choose a company first.");
      return;
    }

    setSaving(true);
    try {
      await updateCompany(session.token, selectedCompany.id, { isActive: nextActive });
      await reloadAfterChange(
        `${selectedCompany.name} was ${nextActive ? "activated" : "deactivated"} and the company directory has been refreshed.`,
        selectedCompany.id,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the company status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBranch() {
    if (!session?.token || !selectedCompany || !branchName.trim() || !branchCode.trim()) {
      setMessage("Choose a company and enter the new branch name and code.");
      return;
    }

    setSaving(true);
    try {
      await createBranch(session.token, selectedCompany.id, { name: branchName.trim(), code: branchCode.trim() });
      setBranchName("");
      setBranchCode("");
      await reloadAfterChange(`Branch created under ${selectedCompany.name}.`, selectedCompany.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create branch.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCloneCompany() {
    if (!session?.token || !selectedCompany || !cloneName.trim()) {
      setMessage("Choose a source company and provide a name for the clone.");
      return;
    }

    setSaving(true);
    try {
      const result = await cloneCompany(session.token, selectedCompany.id, {
        name: cloneName.trim(),
        code: cloneCode.trim() || undefined,
        branchCodePrefix: (cloneCode.trim() || cloneName.trim()).slice(0, 6).toUpperCase(),
      });
      setCloneName("");
      setCloneCode("");
      await reloadAfterChange(
        `${result.company.name} was cloned and is ready for branch, user, COA, and tax follow-up setup.`,
        result.company.id,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clone company.");
    } finally {
      setSaving(false);
    }
  }

  function beginNewCompany() {
    setSelectedCompanyId(null);
    setCompanyForm(emptyCompanyForm());
    document.getElementById("company-settings-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function downloadImportTemplate(kind: "accounts" | "customers" | "products") {
    if (kind === "accounts") {
      downloadCsvFile("chart-of-accounts-template.csv", ["code", "name", "type"], [
        ["1000", "Cash at Bank", "ASSET"],
        ["2100", "Accrued Expenses", "LIABILITY"],
        ["6100", "Payroll Expense", "EXPENSE"],
      ]);
      setMessage("Downloaded chart of accounts template.");
      return;
    }

    if (kind === "customers") {
      downloadCsvFile("customers-template.csv", ["name", "email", "phone", "taxId"], [["Atlantic Retail", "ap@atlanticretail.com", "+2348000000000", "CUST-001"]]);
      setMessage("Downloaded customer import template.");
      return;
    }

    downloadCsvFile("products-template.csv", ["sku", "name", "category", "unitPrice"], [["RM-001", "Resin pellets", "Raw Materials", "1250"]]);
    setMessage("Downloaded product import template.");
  }

  return (
    <WorkspaceShell
      title="Companies"
      description="Create, activate, edit, and bootstrap legal entities from Administration/Setup so the ERP stays multi-company ready and operationally controlled."
      requiredRoles={["admin", "cfo"]}
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={beginNewCompany}>
              New company
            </button>
          }
          summary="Create and maintain company records here, then continue with branch setup, user provisioning, tax mapping, and chart-of-accounts configuration."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Company settings",
                  description: "Jump to create or edit company details",
                  onSelect: () => document.getElementById("company-settings-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Branch setup",
                  description: "Jump to branch creation for the selected company",
                  onSelect: () => document.getElementById("branch-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Clone company",
                  description: "Create a new entity from the current company setup",
                  onSelect: () => document.getElementById("company-clone-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Tools",
              items: [
                { label: "Assign users", href: "/administration?view=Users", description: "Provision access after company creation" },
                { label: "Import / Export", href: "/administration?view=Import%20%26%20Export", description: "Load master data into the new company" },
              ],
            },
          ]}
        />
      }
    >
      <section className="content-grid thirds">
        <SectionCard title="Create from scratch" eyebrow="New legal entity">
          <div className="action-stack">
            <button type="button" className="action-card left-align" onClick={beginNewCompany}>
              <strong>Enter new company data</strong>
              <span>Use this when you want a clean legal entity with its own code, tax details, fiscal year, and feature switches.</span>
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Migrate data" eyebrow="ERP transition path">
          <div className="action-stack">
            <button type="button" className="action-card left-align" onClick={() => document.getElementById("migration-templates")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <strong>Prepare migration templates</strong>
              <span>Download setup templates for accounts, customers, and products before importing data into the new company.</span>
            </button>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Company directory" eyebrow="Administration / Setup">
          <DataTable
            title="Companies"
            tableId="organization-companies"
            exportFileName="companies"
            rows={companyRows}
            searchValue={(row) => `${row.name} ${row.code} ${row.legalName} ${row.currencyCode} ${row.branchNames} ${row.status}`}
            emptyTitle={loadingDirectory ? "Loading companies" : "No companies yet"}
            emptyMessage={loadingDirectory ? "Refreshing the live company directory from the database." : "Create a company to start a new legal entity workspace."}
            filters={[
              { key: "active", label: "Active", predicate: (row) => row.status === "Approved" },
              { key: "inactive", label: "Inactive", predicate: (row) => row.status === "Archived" },
            ]}
            advancedFilters={[
              { key: "company", label: "Company", type: "text", getValue: (row) => row.name },
              { key: "code", label: "Code", type: "text", getValue: (row) => row.code },
              {
                key: "status",
                label: "Status",
                type: "select",
                getValue: (row) => row.status,
                options: [
                  { value: "Approved", label: "Active" },
                  { value: "Archived", label: "Inactive" },
                ],
              },
              { key: "branches", label: "Branches", type: "number-range", getValue: (row) => row.branches },
            ]}
            columns={[
              {
                key: "name",
                label: "Company",
                render: (row) => (
                  <div>
                    <strong>{row.name}</strong>
                    <p className="cell-subcopy">{row.legalName}</p>
                  </div>
                ),
              },
              { key: "code", label: "Code", render: (row) => row.code },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusBadge status={row.status as "Approved" | "Archived"} />,
                exportValue: (row) => row.status,
              },
              { key: "currency", label: "Currency", render: (row) => row.currencyCode },
              { key: "branches", label: "Branches", className: "numeric", render: (row) => row.branches },
              {
                key: "actions",
                label: "",
                className: "table-actions-cell",
                render: (row) => (
                  <RowActionMenu
                    label={`Company actions for ${row.name}`}
                    items={[
                      {
                        label: "Open settings",
                        description: "Load this company into the settings form",
                        onSelect: () => {
                          setSelectedCompanyId(row.companyId);
                          document.getElementById("company-settings-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        },
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={selectedCompany ? "Company settings" : "Create company"} eyebrow="Create / edit / activate">
          <div id="company-settings-form" className="action-form-stack">
            <div className="action-form action-form--company">
              <div className="action-form__label">
                <Building2 size={16} />
                {selectedCompany ? `${selectedCompany.name} settings` : "New company"}
              </div>

              <div className="inline-grid two">
                <label className="field"><span>Company name</span><input value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. West Africa Trading Ltd" /></label>
                <label className="field"><span>Legal name</span><input value={companyForm.legalName} onChange={(event) => setCompanyForm((current) => ({ ...current, legalName: event.target.value }))} placeholder="Registered legal entity name" /></label>
              </div>

              <div className="inline-grid three">
                <label className="field"><span>Company code</span><input value={companyForm.code} onChange={(event) => setCompanyForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="e.g. WATL" /></label>
                <label className="field"><span>Registration number</span><input value={companyForm.registrationNumber} onChange={(event) => setCompanyForm((current) => ({ ...current, registrationNumber: event.target.value }))} placeholder="Company registration number" /></label>
                <label className="field"><span>Tax ID</span><input value={companyForm.taxId} onChange={(event) => setCompanyForm((current) => ({ ...current, taxId: event.target.value }))} placeholder="Tax / TIN" /></label>
              </div>

              <div className="inline-grid three">
                <label className="field"><span>Email</span><input value={companyForm.email} onChange={(event) => setCompanyForm((current) => ({ ...current, email: event.target.value }))} placeholder="finance@company.com" /></label>
                <label className="field"><span>Phone</span><input value={companyForm.phone} onChange={(event) => setCompanyForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+234..." /></label>
                <label className="field"><span>Logo URL</span><input value={companyForm.logoUrl} onChange={(event) => setCompanyForm((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="https://..." /></label>
              </div>

              <div className="inline-grid two">
                <label className="field"><span>Address line 1</span><input value={companyForm.addressLine1} onChange={(event) => setCompanyForm((current) => ({ ...current, addressLine1: event.target.value }))} placeholder="Street address" /></label>
                <label className="field"><span>Address line 2</span><input value={companyForm.addressLine2} onChange={(event) => setCompanyForm((current) => ({ ...current, addressLine2: event.target.value }))} placeholder="Suite / district" /></label>
              </div>

              <div className="inline-grid four">
                <label className="field"><span>City</span><input value={companyForm.city} onChange={(event) => setCompanyForm((current) => ({ ...current, city: event.target.value }))} /></label>
                <label className="field"><span>State</span><input value={companyForm.state} onChange={(event) => setCompanyForm((current) => ({ ...current, state: event.target.value }))} /></label>
                <label className="field"><span>Country</span><input value={companyForm.country} onChange={(event) => setCompanyForm((current) => ({ ...current, country: event.target.value }))} /></label>
                <label className="field"><span>Base currency</span><input value={companyForm.currencyCode} onChange={(event) => setCompanyForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} placeholder="NGN" /></label>
              </div>

              <div className="inline-grid three">
                <label className="field"><span>Timezone</span><input value={companyForm.timezone} onChange={(event) => setCompanyForm((current) => ({ ...current, timezone: event.target.value }))} /></label>
                <label className="field">
                  <span>Fiscal year start month</span>
                  <select value={companyForm.fiscalYearStartMonth} onChange={(event) => setCompanyForm((current) => ({ ...current, fiscalYearStartMonth: event.target.value }))}>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1} value={String(index + 1)}>
                        {new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, index, 1))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={companyForm.isActive ? "active" : "inactive"} onChange={(event) => setCompanyForm((current) => ({ ...current, isActive: event.target.value === "active" }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              {!selectedCompany ? (
                <div className="inline-grid two">
                  <label className="field"><span>Default branch name</span><input value={companyForm.defaultBranchName} onChange={(event) => setCompanyForm((current) => ({ ...current, defaultBranchName: event.target.value }))} placeholder="Head Office" /></label>
                  <label className="field"><span>Default branch code</span><input value={companyForm.defaultBranchCode} onChange={(event) => setCompanyForm((current) => ({ ...current, defaultBranchCode: event.target.value.toUpperCase() }))} placeholder="HQ" /></label>
                </div>
              ) : null}

              <div className="toggle-grid">
                {[["useBranches", "Multi-branch"], ["useInventory", "Inventory"], ["usePayroll", "Payroll"], ["useDepartments", "Departments"]].map(([key, label]) => (
                  <label key={key} className="checkbox-field">
                    <input type="checkbox" checked={companyForm[key as keyof CompanyForm] as boolean} onChange={(event) => setCompanyForm((current) => ({ ...current, [key]: event.target.checked }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <p className="note">After creation, the company is persisted to the database, added to the global company selector, and bootstrapped with a branch, fiscal year, accounting periods, and document numbering.</p>

              <div className="inline-actions">
                <button type="button" className="primary-button with-icon" onClick={selectedCompany ? handleUpdateCompany : handleCreateCompany} disabled={saving}><Settings2 size={16} />{selectedCompany ? "Save company settings" : "Create company"}</button>
                {selectedCompany ? (
                  <button type="button" className="ghost-button with-icon" onClick={() => void handleToggleCompanyStatus(!companyForm.isActive)} disabled={saving}><Settings2 size={16} />{companyForm.isActive ? "Deactivate company" : "Activate company"}</button>
                ) : (
                  <button type="button" className="ghost-button with-icon" onClick={() => setCompanyForm(emptyCompanyForm())} disabled={saving}><Plus size={16} />Reset form</button>
                )}
              </div>
            </div>

            <div className="action-form action-form--company" id="branch-create-form">
              <div className="action-form__label"><Warehouse size={16} />Add branch to selected company</div>
              <label className="field"><span>Branch name</span><input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="e.g. Abuja Branch" /></label>
              <label className="field"><span>Branch code</span><input value={branchCode} onChange={(event) => setBranchCode(event.target.value.toUpperCase())} placeholder="ABJ" /></label>
              <button type="button" className="ghost-button with-icon" onClick={handleCreateBranch} disabled={saving || !selectedCompany}><Plus size={16} />Add branch</button>
            </div>

            <div className="action-form action-form--company" id="company-clone-form">
              <div className="action-form__label"><CopyPlus size={16} />Clone selected company</div>
              <label className="field"><span>New company name</span><input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder="e.g. Training Company Ltd" /></label>
              <label className="field"><span>New company code</span><input value={cloneCode} onChange={(event) => setCloneCode(event.target.value.toUpperCase())} placeholder="e.g. TRN01" /></label>
              <p className="note">Use this path only when you intentionally want to copy setup structure from the selected company. Operational records stay isolated by company.</p>
              <button type="button" className="ghost-button with-icon" onClick={handleCloneCompany} disabled={saving || !selectedCompany}><CopyPlus size={16} />Clone company</button>
            </div>

            <div className="action-form action-form--company" id="migration-templates">
              <div className="action-form__label"><FileSpreadsheet size={16} />Migration templates</div>
              <p className="note">Use these templates when the new company will be loaded from spreadsheets or another ERP.</p>
              <div className="inline-actions">
                <button type="button" className="ghost-button small" onClick={() => downloadImportTemplate("accounts")}>Download COA template</button>
                <button type="button" className="ghost-button small" onClick={() => downloadImportTemplate("customers")}>Download customer template</button>
                <button type="button" className="ghost-button small" onClick={() => downloadImportTemplate("products")}>Download product template</button>
              </div>
            </div>
          </div>
          <p className="note">{message}</p>
        </SectionCard>
      </section>

      <section className="content-grid thirds">
        <SectionCard title="What happens after creation" eyebrow="Company instruction">
          <div className="action-stack">
            <div className="action-card left-align"><strong>1. Select the company</strong><span>The new company becomes available in the global company selector after a successful save and refresh.</span></div>
            <div className="action-card left-align"><strong>2. Add structure</strong><span>Create branches, then assign users and roles from Administration so access is controlled by the admin team.</span></div>
            <div className="action-card left-align"><strong>3. Configure finance and tax</strong><span>Set up chart of accounts, numbering, tax rules, and opening balances before operational posting starts.</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Selected company" eyebrow="Scope and readiness">
          {selectedCompany ? (
            <div className="action-stack">
              <div className="action-card left-align"><strong>{selectedCompany.name}</strong><span>{selectedCompany.code ?? "No code yet"} • {selectedCompany.currency?.code ?? "NGN"} • {selectedCompany.branches.length} branch(es)</span></div>
              <div className="action-card left-align"><strong>Company context</strong><span>Global company and branch selectors now drive the active workspace context for company-aware modules and reports.</span></div>
            </div>
          ) : (
            <p className="note">Select a company from the directory to review its setup and continue configuration.</p>
          )}
        </SectionCard>

        <SectionCard title="Next setup actions" eyebrow="After company creation">
          {nextSteps.length ? (
            <div className="action-stack">
              {nextSteps.map((step) =>
                "href" in step ? (
                  <a key={step.label} href={step.href} className="action-card left-align"><strong>{step.label}</strong><span>{step.hint}</span></a>
                ) : (
                  <button key={step.label} type="button" className="action-card left-align" onClick={step.action}><strong>{step.label}</strong><span>{step.hint}</span></button>
                ),
              )}
            </div>
          ) : (
            <p className="note">Create or select a company to expose the next setup actions.</p>
          )}
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
