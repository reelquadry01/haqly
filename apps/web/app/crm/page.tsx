"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { ProcessArchitecturePanel } from "../../components/ui/process-architecture-panel";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { createSalesCustomer, getSalesCustomers, getSalesInvoices, updateSalesCustomer, type SalesCustomer, type SalesInvoiceRecord } from "../../lib/api";
import { crmViews, type AppStatus, type KpiMetric } from "../../lib/erp";
import { useWorkspace } from "../../hooks/use-workspace";
import { buildCrmWorkflow } from "../../lib/process-flows";

type CustomerOnboardingDraft = {
  name: string;
  customerType: string;
  onboardingStatus: string;
  contactPerson: string;
  email: string;
  phone: string;
  industry: string;
  taxId: string;
  creditLimit: string;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
};

const defaultCustomerDraft: CustomerOnboardingDraft = {
  name: "",
  customerType: "BUSINESS",
  onboardingStatus: "PENDING",
  contactPerson: "",
  email: "",
  phone: "",
  industry: "",
  taxId: "",
  creditLimit: "",
  addressLine1: "",
  city: "",
  state: "",
  country: "Nigeria",
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatAddress(customer: SalesCustomer) {
  const address = customer.addresses?.[0];
  if (!address) {
    return "-";
  }
  return [address.line1, address.city, address.state, address.country].filter(Boolean).join(", ");
}

function normalizeCustomerStatus(status: string | null | undefined): AppStatus {
  const value = (status ?? "").toLowerCase();
  if (value.includes("approved") || value.includes("active")) return "Approved";
  if (value.includes("submit")) return "Submitted";
  if (value.includes("reject")) return "Rejected";
  return "Pending";
}

export default function CrmPage() {
  const { session, activeCompany } = useWorkspace();
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [message, setMessage] = useState("Create and onboard customers here so CRM, sales, and finance work from the same master record.");
  const [saving, setSaving] = useState(false);
  const [updatingCustomerId, setUpdatingCustomerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<CustomerOnboardingDraft>(defaultCustomerDraft);

  async function loadCustomers(token: string) {
    setLoading(true);
    try {
      const data = await getSalesCustomers(token, activeCompany?.id);
      const invoiceRows = await getSalesInvoices(token, activeCompany?.id);
      setCustomers(data);
      setInvoices(invoiceRows);
      setMessage("Customer master is live. New onboarding records will appear instantly after save.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) return;
    void loadCustomers(session.token);
  }, [activeCompany?.id, session?.token]);

  const approvedCustomerCount = useMemo(
    () => customers.filter((customer) => (customer.onboardingStatus ?? "PENDING") === "APPROVED").length,
    [customers],
  );

  const pendingOnboardingCount = useMemo(
    () => customers.filter((customer) => (customer.onboardingStatus ?? "PENDING") !== "APPROVED").length,
    [customers],
  );

  const processBlueprint = useMemo(
    () =>
      buildCrmWorkflow({
        customerCount: customers.length,
        pendingOnboardingCount,
        approvedCustomerCount,
        invoiceCount: invoices.length,
      }),
    [approvedCustomerCount, customers.length, invoices.length, pendingOnboardingCount],
  );

  const customerRows = useMemo(() => {
    return customers.map((customer) => ({
      id: String(customer.id),
      backendId: customer.id,
      name: customer.name,
      customerType: customer.customerType ?? "BUSINESS",
      onboardingStatus: customer.onboardingStatus ?? "PENDING",
      contactPerson: customer.contactPerson || "-",
      email: customer.email || "-",
      phone: customer.phone || "-",
      industry: customer.industry || "-",
      address: formatAddress(customer),
      creditLimit: customer.creditLimit ? formatCurrency(customer.creditLimit) : "-",
    }));
  }, [customers]);

  const interactionRows = useMemo(() => {
    return customers.map((customer) => {
      const customerInvoices = invoices.filter((invoice) => invoice.customerId === customer.id);
      const totalBilled = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
      const latestInvoice = customerInvoices
        .slice()
        .sort((left, right) => new Date(right.updatedAt ?? right.date).getTime() - new Date(left.updatedAt ?? left.date).getTime())[0];

      const stage =
        (customer.onboardingStatus ?? "PENDING") !== "APPROVED"
          ? "Onboarding"
          : customerInvoices.length
            ? "Invoiced"
            : "Ready for first sale";

      return {
        id: String(customer.id),
        customer: customer.name,
        owner: customer.contactPerson || "No contact assigned",
        stage,
        invoiceCount: customerInvoices.length,
        value: formatCurrency(totalBilled),
        lastActivity: latestInvoice ? new Date(latestInvoice.updatedAt ?? latestInvoice.date).toLocaleDateString("en-GB") : "No invoice yet",
        nextAction:
          stage === "Onboarding"
            ? "Approve onboarding"
            : customerInvoices.length
              ? "Review statements"
              : "Create first invoice",
        status: normalizeCustomerStatus(customer.onboardingStatus),
      };
    });
  }, [customers, invoices]);

  const metrics = useMemo<KpiMetric[]>(() => [
    {
      label: "Customers",
      value: String(customers.length),
      delta: "Live customer master",
      trend: customers.length ? "up" : "neutral",
      detail: "Customer relationships connected to sales and statements",
    },
    {
      label: "Business accounts",
      value: String(customers.filter((customer) => (customer.customerType ?? "BUSINESS") === "BUSINESS").length),
      delta: "Corporate onboarding",
      trend: "up",
      detail: "Companies and institutions managed in CRM",
    },
    {
      label: "Pending onboarding",
      value: String(customers.filter((customer) => (customer.onboardingStatus ?? "PENDING") === "PENDING").length),
      delta: "Needs follow-up",
      trend: "neutral",
      detail: "Customers still in KYC/onboarding flow",
    },
    {
      label: "Customer follow-up",
      value: String(interactionRows.length),
      delta: "Derived from live customers",
      trend: "neutral",
      detail: "Onboarding and billing follow-up generated from database records",
    },
  ], [customers.length, interactionRows.length]);

  async function handleCreateCustomer() {
    if (!session?.token) {
      setMessage("You need an active session before onboarding a customer.");
      return;
    }
    if (!draft.name.trim()) {
      setMessage("Customer name is required.");
      return;
    }

    setSaving(true);
    try {
      const created = await createSalesCustomer(session.token, {
        companyId: activeCompany!.id,
        name: draft.name.trim(),
        customerType: draft.customerType,
        onboardingStatus: draft.onboardingStatus,
        contactPerson: draft.contactPerson.trim() || undefined,
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        industry: draft.industry.trim() || undefined,
        taxId: draft.taxId.trim() || undefined,
        creditLimit: draft.creditLimit ? Number(draft.creditLimit) : undefined,
        addressLine1: draft.addressLine1.trim() || undefined,
        city: draft.city.trim() || undefined,
        state: draft.state.trim() || undefined,
        country: draft.country.trim() || undefined,
      });
      await loadCustomers(session.token);
      setDraft(defaultCustomerDraft);
      setMessage(`${created.name} has been saved to the customer master and the CRM register has been refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCustomerApproval(customerId: number, name: string, onboardingStatus: "APPROVED" | "REJECTED") {
    if (!session?.token) {
      setMessage("You need an active session before approving onboarding.");
      return;
    }

    setUpdatingCustomerId(customerId);
    try {
      await updateSalesCustomer(session.token, customerId, activeCompany!.id, { onboardingStatus });
      await loadCustomers(session.token);
      setMessage(`${name} has been ${onboardingStatus === "APPROVED" ? "approved" : "rejected"} and the CRM register has been refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update onboarding status.");
    } finally {
      setUpdatingCustomerId(null);
    }
  }

  async function handleCustomerBulkAction(action: string, rows: Array<(typeof customerRows)[number]>) {
    if (!session?.token) {
      setMessage("You need an active session before approving onboarding.");
      return;
    }

    const lowered = action.toLowerCase();
    if (!lowered.includes("approve") && !lowered.includes("reject")) {
      return;
    }

    const nextStatus = lowered.includes("reject") ? "REJECTED" : "APPROVED";
    const actionableRows = rows.filter((row) => row.onboardingStatus !== nextStatus);
    if (!actionableRows.length) {
      setMessage(`Selected customers are already ${nextStatus.toLowerCase()}.`);
      return;
    }

    setUpdatingCustomerId(-1);
    try {
      await Promise.all(
        actionableRows.map((row) => updateSalesCustomer(session.token!, row.backendId, activeCompany!.id, { onboardingStatus: nextStatus })),
      );
      await loadCustomers(session.token);
      setMessage(`${actionableRows.length} customer onboarding record(s) ${nextStatus === "APPROVED" ? "approved" : "rejected"} and refreshed from the ERP database.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update selected onboarding records.");
    } finally {
      setUpdatingCustomerId(null);
    }
  }

  return (
    <WorkspaceShell
      title="Customer Relationship Management"
      description="Manage customer onboarding, customer types, interactions, and relationship visibility from one CRM workspace."
      requiredRoles={["cfo", "accountant", "admin", "ceo"]}
      tabs={crmViews}
      activeTab="Dashboard"
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={() => document.getElementById("crm-onboarding-desk")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              New customer
            </button>
          }
          summary="New customer creation stays visible. Refresh, statement lookups, and directory access are grouped into menus above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh customers",
                  description: "Load the latest customer master from the backend",
                  onSelect: () => session?.token && loadCustomers(session.token),
                },
                {
                  label: "Open onboarding desk",
                  description: "Jump to the customer onboarding workbench",
                  onSelect: () => document.getElementById("crm-onboarding-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Customer statements", href: "/reports?view=Account%20Statement%20Summary", description: "Statement summaries and balances" },
                { label: "Sales invoices", href: "/sales", description: "Open invoice operations" },
              ],
            },
            {
              label: "More",
              items: [
                {
                  label: "Customer master",
                  description: "Jump to the shared customer directory",
                  onSelect: () => document.getElementById("crm-customer-master")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
          ]}
        />
      }
    >
      <ProcessArchitecturePanel
        blueprint={processBlueprint}
        checklistActions={{
          "crm-customer": {
            label: customers.length ? "Review customer master" : "Create customer",
            onSelect: () => document.getElementById("crm-onboarding-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          "crm-approval": {
            label: approvedCustomerCount ? "Open customer master" : "Approve onboarding",
            onSelect: () => document.getElementById("crm-customer-master")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          "crm-sales-link": {
            label: invoices.length ? "Open sales" : "Go to invoicing",
            href: "/sales",
          },
        }}
        nextActions={[
          {
            id: "crm-next-onboard",
            label: "Complete onboarding",
            detail: "Capture, classify, and approve customer records before handing them to sales.",
            onSelect: () => document.getElementById("crm-onboarding-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          {
            id: "crm-next-invoice",
            label: "Convert to invoice",
            detail: "Move approved customers into live invoicing without recreating party data.",
            href: "/sales",
          },
          {
            id: "crm-next-statements",
            label: "Review statements",
            detail: "Use statements to see how CRM customers are performing financially.",
            href: "/reports?view=Account%20Statement%20Summary",
          },
        ]}
      />

      <section className="kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="sales" />)}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Customer onboarding desk" eyebrow="Create and classify customers">
          <div className="action-form-stack" id="crm-onboarding-desk">
            <div className="form-grid two-up">
              <label className="field">
                <span>Customer name</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Atlantic Retail Limited" />
              </label>
              <label className="field">
                <span>Customer type</span>
                <select className="select-input" value={draft.customerType} onChange={(event) => setDraft((current) => ({ ...current, customerType: event.target.value }))}>
                  <option value="BUSINESS">Business</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAIL">Retail</option>
                </select>
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Onboarding status</span>
                <select className="select-input" value={draft.onboardingStatus} onChange={(event) => setDraft((current) => ({ ...current, onboardingStatus: event.target.value }))}>
                  <option value="PENDING">Pending</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
              <label className="field">
                <span>Contact person</span>
                <input value={draft.contactPerson} onChange={(event) => setDraft((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="e.g. Ada Okafor" />
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Email</span>
                <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="e.g. finance@atlanticretail.com" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="e.g. +2348000000000" />
              </label>
            </div>

            <div className="form-grid three-up">
              <label className="field">
                <span>Industry</span>
                <input value={draft.industry} onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))} placeholder="e.g. Retail" />
              </label>
              <label className="field">
                <span>Tax ID</span>
                <input value={draft.taxId} onChange={(event) => setDraft((current) => ({ ...current, taxId: event.target.value }))} placeholder="e.g. 10293847-0001" />
              </label>
              <label className="field">
                <span>Credit limit</span>
                <input type="number" value={draft.creditLimit} onChange={(event) => setDraft((current) => ({ ...current, creditLimit: event.target.value }))} placeholder="e.g. 2500000" />
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Address line</span>
                <input value={draft.addressLine1} onChange={(event) => setDraft((current) => ({ ...current, addressLine1: event.target.value }))} placeholder="e.g. 14 Marina Road" />
              </label>
              <label className="field">
                <span>City</span>
                <input value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} placeholder="e.g. Lagos" />
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>State</span>
                <input value={draft.state} onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))} placeholder="e.g. Lagos State" />
              </label>
              <label className="field">
                <span>Country</span>
                <input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} />
              </label>
            </div>

            <div className="inline-actions compact-end">
              <button className="ghost-button with-icon" type="button" onClick={() => setDraft(defaultCustomerDraft)}>
                Reset
              </button>
              <button className="primary-button with-icon" type="button" onClick={handleCreateCustomer} disabled={saving}>
                <Plus size={16} /> {saving ? "Saving..." : "Create customer"}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Pipeline and interaction desk" eyebrow="Derived from live CRM and invoice data">
          <DataTable
            title="Customer follow-up"
            tableId="crm-interactions"
            exportFileName="crm-interactions"
            rows={interactionRows}
            searchValue={(row) => `${row.customer} ${row.owner} ${row.stage} ${row.nextAction}`}
            filters={[
              { key: "onboarding", label: "Onboarding", predicate: (row) => row.stage === "Onboarding" },
              { key: "ready", label: "Ready for sale", predicate: (row) => row.stage === "Ready for first sale" },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle={loading ? "Loading customer follow-up" : "No customer follow-up yet"}
            emptyMessage={loading ? "Reading live customer and invoice data." : "Create customers first and follow-up rows will be derived from real CRM activity."}
            columns={[
              { key: "customer", label: "Customer", render: (row) => <strong>{row.customer}</strong>, exportValue: (row) => row.customer },
              { key: "owner", label: "Owner", render: (row) => row.owner, exportValue: (row) => row.owner },
              { key: "stage", label: "Stage", render: (row) => row.stage, exportValue: (row) => row.stage },
              { key: "invoiceCount", label: "Invoices", className: "numeric", render: (row) => row.invoiceCount, exportValue: (row) => row.invoiceCount },
              { key: "value", label: "Billed", className: "numeric", render: (row) => row.value, exportValue: (row) => row.value },
              { key: "lastActivity", label: "Last activity", render: (row) => row.lastActivity, exportValue: (row) => row.lastActivity },
              { key: "nextAction", label: "Next action", render: (row) => row.nextAction, exportValue: (row) => row.nextAction },
            ]}
          />
        </SectionCard>
      </section>

      <SectionCard title="Customer master" eyebrow="Live backend data">
        <div id="crm-customer-master" />
        <DataTable
          title="Customers"
          tableId="crm-customers"
          exportFileName="crm-customers"
          rows={customerRows}
          searchValue={(row) => `${row.name} ${row.email} ${row.phone} ${row.customerType} ${row.industry}`}
          filters={[
            { key: "business", label: "Business", predicate: (row) => row.customerType === "BUSINESS" },
            { key: "individual", label: "Individual", predicate: (row) => row.customerType === "INDIVIDUAL" },
            { key: "pending", label: "Pending onboarding", predicate: (row) => row.onboardingStatus === "PENDING" },
            { key: "approved", label: "Approved", predicate: (row) => row.onboardingStatus === "APPROVED" },
          ]}
          advancedFilters={[
            { key: "type", label: "Customer type", type: "select", options: [...new Set(customerRows.map((row) => row.customerType))].map((value) => ({ label: value, value })), getValue: (row) => row.customerType },
            { key: "onboarding", label: "Onboarding", type: "select", options: [...new Set(customerRows.map((row) => row.onboardingStatus))].map((value) => ({ label: value, value })), getValue: (row) => row.onboardingStatus },
            { key: "industry", label: "Industry", type: "text", placeholder: "Filter by industry", getValue: (row) => row.industry },
            { key: "contact", label: "Contact person", type: "text", placeholder: "Filter by contact", getValue: (row) => row.contactPerson },
          ]}
          bulkActions={["Approve onboarding", "Reject onboarding", "Export CSV", "Export Excel", "Export PDF"]}
          onBulkAction={handleCustomerBulkAction}
          emptyTitle={loading ? "Loading customers" : "No customers yet"}
          emptyMessage={loading ? "Reading the live customer master from the backend." : message}
          columns={[
            { key: "name", label: "Customer", render: (row) => <strong>{row.name}</strong>, exportValue: (row) => row.name },
            { key: "customerType", label: "Type", render: (row) => row.customerType, exportValue: (row) => row.customerType },
            { key: "onboardingStatus", label: "Onboarding", render: (row) => <StatusBadge status={normalizeCustomerStatus(row.onboardingStatus)} />, exportValue: (row) => row.onboardingStatus },
            { key: "contactPerson", label: "Contact person", render: (row) => row.contactPerson, exportValue: (row) => row.contactPerson },
            { key: "industry", label: "Industry", render: (row) => row.industry, exportValue: (row) => row.industry },
            { key: "creditLimit", label: "Credit limit", className: "numeric", render: (row) => row.creditLimit, exportValue: (row) => row.creditLimit },
            { key: "email", label: "Email", render: (row) => row.email, exportValue: (row) => row.email },
            { key: "phone", label: "Phone", render: (row) => row.phone, exportValue: (row) => row.phone },
            { key: "address", label: "Address", render: (row) => row.address, exportValue: (row) => row.address },
            {
              key: "actions",
              label: "Actions",
              render: (row) =>
                row.onboardingStatus === "APPROVED" ? (
                  <span className="cell-subcopy">Approved</span>
                ) : (
                  <div className="table-row-actions">
                    <button
                      className="ghost-button small"
                      type="button"
                      disabled={updatingCustomerId !== null}
                      onClick={() => void handleCustomerApproval(row.backendId, row.name, "APPROVED")}
                    >
                      {updatingCustomerId === row.backendId ? "Updating..." : "Approve"}
                    </button>
                    {row.onboardingStatus !== "REJECTED" ? (
                      <button
                        className="ghost-button small"
                        type="button"
                        disabled={updatingCustomerId !== null}
                        onClick={() => void handleCustomerApproval(row.backendId, row.name, "REJECTED")}
                      >
                        Reject
                      </button>
                    ) : null}
                  </div>
                ),
              exportValue: (row) => (row.onboardingStatus === "APPROVED" ? "Approved" : "Pending action"),
            },
          ]}
        />
        <p className="note">{message}</p>
      </SectionCard>
    </WorkspaceShell>
  );
}
