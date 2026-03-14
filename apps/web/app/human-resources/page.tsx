"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { useCompanyPersistentState } from "../../hooks/use-company-persistent-state";
import { useWorkspace } from "../../hooks/use-workspace";
import { payrollViews, type KpiMetric } from "../../lib/erp";

export default function HumanResourcesPage() {
  const router = useRouter();
  const { activeCompany } = useWorkspace();
  const [payrollState] = useCompanyPersistentState("payroll", activeCompany?.id, {
    draft: { period: "", payDate: "", note: "", status: "Draft", employees: 0, netPay: 0 },
    message: "",
    localRuns: [] as Array<{ id: string; period: string; employees: number; netPay: string; status: string; owner: string; payDate: string }>,
  });

  const metrics: KpiMetric[] = useMemo(
    () => [
      { label: "Employees", value: "0", delta: "Backend not wired", trend: "neutral", detail: "Employee master rows will appear once HR tables are mapped to the API" },
      { label: "Payroll runs", value: String(payrollState.localRuns.length), delta: "Company-local history", trend: payrollState.localRuns.length ? "up" : "neutral", detail: "Payroll cycles captured in the current company workspace" },
      { label: "Bank-ready staff", value: "0", delta: "Backend not wired", trend: "neutral", detail: "Bank setup readiness will appear when employee data is mapped" },
      { label: "HR exceptions", value: "0", delta: "Backend not wired", trend: "neutral", detail: "HR exceptions are hidden until employee records are mapped to the database" },
    ],
    [payrollState.localRuns.length],
  );

  return (
    <WorkspaceShell
      title="Human Resources"
      description="Manage employee records, attendance readiness, leave visibility, and payroll-linked workforce controls."
      requiredRoles={["hr", "admin", "ceo", "cfo"]}
      tabs={payrollViews}
      activeTab="Employees"
      pageActions={
        <ModuleActionBar
          primaryLabel="Open payroll workspace"
          onPrimaryAction={() => router.push("/hr-payroll")}
          summary="Keep the employee and payroll workflow predictable: one primary path visible, secondary HR tools grouped above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Employee directory",
                  description: "Jump to workforce records",
                  onSelect: () => document.getElementById("hr-employee-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
                {
                  label: "Payroll cycles",
                  description: "Jump to cycle history",
                  onSelect: () => document.getElementById("hr-payroll-cycles")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Payroll register", href: "/hr-payroll", description: "Open the payroll register workspace" },
                { label: "HR reports", href: "/reports", description: "Review reporting and exports" },
              ],
            },
            {
              label: "More",
              items: [
                { label: "Leave and attendance", href: "/hr-payroll", description: "Open broader HR operations" },
                { label: "Administration", href: "/administration", description: "Manage user and access setup" },
              ],
            },
          ]}
        />
      }
    >
      <section className="kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} metric={metric} tone="payroll" />)}
      </section>

      <section className="content-grid split-65">
        <SectionCard title="Employee directory" eyebrow="Workforce records">
          <div id="hr-employee-directory" />
          <EmptyState
            tone="payroll"
            title="No employee directory mapped yet"
            body="This page no longer shows hardcoded employee records. Employee data will appear here when HR tables are connected to the backend."
          />
        </SectionCard>

        <SectionCard title="Payroll-linked HR activity" eyebrow="Cycle visibility">
          <div id="hr-payroll-cycles" />
          <DataTable
            title="Payroll cycles"
            tableId="human-resources-payroll-runs"
            exportFileName="human-resources-payroll-runs"
            rows={payrollState.localRuns}
            searchValue={(row) => `${row.period} ${row.owner} ${row.status}`}
            advancedFilters={[
              { key: "period", label: "Period", type: "text", getValue: (row) => row.period },
              { key: "owner", label: "Owner", type: "text", getValue: (row) => row.owner },
              { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [...new Set(payrollState.localRuns.map((row) => row.status))].map((value) => ({ value, label: value })) },
              { key: "employees", label: "Employees", type: "number-range", getValue: (row) => row.employees },
            ]}
            bulkActions={["Export CSV", "Export Excel", "Export PDF"]}
            emptyTitle="No payroll cycles yet"
            emptyMessage="Payroll run history will appear here after runs are created in the Payroll workspace."
            columns={[
              { key: "period", label: "Period", render: (row) => <strong>{row.period}</strong>, exportValue: (row) => row.period },
              { key: "employees", label: "Employees", className: "numeric", render: (row) => row.employees, exportValue: (row) => row.employees },
              { key: "netPay", label: "Net pay", className: "numeric", render: (row) => row.netPay, exportValue: (row) => row.netPay },
              { key: "payDate", label: "Pay date", render: (row) => row.payDate, exportValue: (row) => row.payDate },
              { key: "status", label: "Status", render: (row) => row.status, exportValue: (row) => row.status },
            ]}
          />
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
