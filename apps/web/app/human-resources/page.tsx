"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import { getEmployees, getPayrollRuns, type EmployeeRecord, type PayrollRunRecord } from "../../lib/api";
import { payrollViews, type KpiMetric } from "../../lib/erp";

export default function HumanResourcesPage() {
  const router = useRouter();
  const { session, activeCompany } = useWorkspace();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async (token: string, companyId?: number) => {
    const [emps, runsData] = await Promise.all([
      getEmployees(token, companyId),
      getPayrollRuns(token, companyId),
    ]);
    setEmployees(emps);
    setRuns(runsData);
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    load(session.token, activeCompany?.id).catch((err) =>
      setMessage(err instanceof Error ? err.message : "Could not load HR data."),
    );
  }, [session?.token, activeCompany?.id, load]);

  const metrics = useMemo<KpiMetric[]>(() => {
    const active = employees.filter((e) => e.status === "ACTIVE").length;
    const inactive = employees.filter((e) => e.status !== "ACTIVE").length;
    const bankReady = employees.filter((e) => e.status === "ACTIVE" && !!e.email).length;
    const exceptions = inactive;

    return [
      { label: "Employees", value: String(active), delta: "Active", trend: active ? "up" : "neutral", detail: "Employees with ACTIVE status in the company" },
      { label: "Payroll runs", value: String(runs.length), delta: "All periods", trend: runs.length ? "up" : "neutral", detail: "Payroll cycles for this company" },
      { label: "Bank-ready staff", value: String(bankReady), delta: "Active with email", trend: bankReady ? "up" : "neutral", detail: "Active employees with an email address on record" },
      { label: "HR exceptions", value: String(exceptions), delta: "Inactive / terminated", trend: exceptions ? "down" : "neutral", detail: "Employees not in active status" },
    ];
  }, [employees, runs]);

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

      {message && <p className="note">{message}</p>}

      <section className="content-grid split-65">
        <SectionCard title="Employee directory" eyebrow="Workforce records">
          <div id="hr-employee-directory" />
          {employees.length === 0 ? (
            <EmptyState
              tone="payroll"
              title="No employees yet"
              body="Employees added via the Payroll workspace will appear here."
            />
          ) : (
            <DataTable
              title="Employees"
              tableId="hr-employee-directory-table"
              exportFileName="employees"
              rows={employees}
              searchValue={(row) => `${row.employeeNo} ${row.firstName} ${row.lastName} ${row.jobTitle ?? ""} ${row.email ?? ""}`}
              advancedFilters={[
                { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE", "TERMINATED"].map((v) => ({ label: v, value: v })), getValue: (row) => row.status },
                { key: "jobTitle", label: "Job title", type: "text", placeholder: "Filter by title", getValue: (row) => row.jobTitle ?? "" },
              ]}
              columns={[
                { key: "employeeNo", label: "No.", render: (row) => <strong>{row.employeeNo}</strong> },
                { key: "name", label: "Name", render: (row) => `${row.firstName} ${row.lastName}` },
                { key: "email", label: "Email", render: (row) => row.email ?? "—" },
                { key: "jobTitle", label: "Title", render: (row) => row.jobTitle ?? "—" },
                { key: "department", label: "Department", render: (row) => row.department?.name ?? "—" },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard title="Payroll-linked HR activity" eyebrow="Cycle visibility">
          <div id="hr-payroll-cycles" />
          <DataTable
            title="Payroll cycles"
            tableId="human-resources-payroll-runs"
            exportFileName="human-resources-payroll-runs"
            rows={runs}
            searchValue={(row) => `${row.period} ${row.status}`}
            advancedFilters={[
              { key: "period", label: "Period", type: "text", getValue: (row) => row.period },
              { key: "status", label: "Status", type: "select", getValue: (row) => row.status, options: [...new Set(runs.map((r) => r.status))].map((v) => ({ value: v, label: v })) },
            ]}
            bulkActions={["Export CSV"]}
            emptyTitle="No payroll cycles yet"
            emptyMessage="Payroll run history will appear here after runs are created in the Payroll workspace."
            columns={[
              { key: "period", label: "Period", render: (row) => <strong>{row.period}</strong> },
              { key: "lines", label: "Lines", className: "numeric", render: (row) => row._count?.lines ?? 0 },
              { key: "payDate", label: "Pay date", render: (row) => row.payDate },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </SectionCard>
      </section>
    </WorkspaceShell>
  );
}
