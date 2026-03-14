export type AppRole =
  | "cfo"
  | "accountant"
  | "procurement"
  | "inventory"
  | "hr"
  | "admin"
  | "ceo";

export type AppStatus =
  | "Draft"
  | "Pending"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Posted"
  | "Reversed"
  | "Overdue"
  | "Closed"
  | "Archived";

export type NavItem = {
  href: string;
  label: string;
  section: string;
  roles: AppRole[];
  caption?: string;
  icon: IconName;
};

export type KpiMetric = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  detail: string;
  href?: string;
  status?: AppStatus;
};

export type ActionItem = {
  label: string;
  hint: string;
  href: string;
  icon?: IconName;
};

export type ModuleMenuItem = {
  label: string;
  href: string;
  description?: string;
};

export type ModuleMenuGroup = {
  label: string;
  items: ModuleMenuItem[];
};

export type IconName =
  | "home"
  | "finance"
  | "financialManagement"
  | "sales"
  | "crm"
  | "procurement"
  | "inventory"
  | "scm"
  | "tax"
  | "assets"
  | "payroll"
  | "reports"
  | "bi"
  | "admin"
  | "organization"
  | "loans"
  | "search"
  | "notification"
  | "plus"
  | "company"
  | "branch"
  | "calendar"
  | "user";

export type TimelineItem = {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  user: string;
  status?: AppStatus;
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  href?: string;
};

export type ApprovalStep = {
  id: string;
  label: string;
  owner: string;
  status: AppStatus;
  timestamp?: string;
};

export const roleOptions: Array<{ value: AppRole; label: string; homeLabel: string }> = [
  { value: "cfo", label: "CFO / Finance Director", homeLabel: "Finance command center" },
  { value: "accountant", label: "Accountant", homeLabel: "Books and controls" },
  { value: "procurement", label: "Procurement Officer", homeLabel: "Sourcing and approvals" },
  { value: "inventory", label: "Inventory / Store Officer", homeLabel: "Stock control workspace" },
  { value: "hr", label: "HR / Payroll Officer", homeLabel: "People and payroll" },
  { value: "admin", label: "Administrator", homeLabel: "System administration" },
  { value: "ceo", label: "CEO / Executive", homeLabel: "Executive overview" },
];

export const navigationItems: NavItem[] = [
  { href: "/dashboard", label: "Home", section: "Main", roles: ["cfo", "accountant", "procurement", "inventory", "hr", "admin", "ceo"], icon: "home" },
  { href: "/finance", label: "Finance", section: "Workspace", roles: ["cfo", "accountant", "admin", "ceo"], icon: "finance" },
  { href: "/sales", label: "Sales", section: "Workspace", roles: ["cfo", "accountant", "admin", "ceo"], icon: "sales" },
  { href: "/crm", label: "CRM", section: "Workspace", roles: ["cfo", "accountant", "admin", "ceo"], icon: "crm" },
  { href: "/procurement", label: "Procurement", section: "Workspace", roles: ["procurement", "cfo", "accountant", "admin", "ceo"], icon: "procurement" },
  { href: "/inventory", label: "Inventory", section: "Workspace", roles: ["inventory", "procurement", "accountant", "admin", "ceo"], icon: "inventory" },
  { href: "/supply-chain", label: "Supply Chain", section: "Workspace", roles: ["inventory", "procurement", "accountant", "admin", "ceo"], icon: "scm" },
  { href: "/hr-payroll", label: "Payroll / HR", section: "Workspace", roles: ["hr", "cfo", "admin", "ceo"], icon: "payroll" },
  { href: "/reports", label: "Reports", section: "Insights", roles: ["cfo", "accountant", "procurement", "inventory", "hr", "admin", "ceo"], icon: "reports" },
  { href: "/administration", label: "Administration", section: "Setup", roles: ["admin", "cfo"], icon: "admin" },
];

export function getRoleLabel(role: AppRole) {
  return roleOptions.find((item) => item.value === role)?.label ?? "Workspace role";
}

export function getNavigationForRole(role: AppRole) {
  return navigationItems.filter((item) => item.roles.includes(role));
}

export const notificationFeed = [
  {
    id: "n1",
    title: "Payment approval pending",
    detail: "Three vouchers are waiting for finance approval before cutoff.",
    when: "5 min ago",
  },
  {
    id: "n2",
    title: "Low stock alert",
    detail: "Industrial solvent is below reorder level in Lekki warehouse.",
    when: "18 min ago",
  },
  {
    id: "n3",
    title: "Period close warning",
    detail: "March close checklist still has two unreconciled bank lines.",
    when: "41 min ago",
  },
];

export const quickCreateActions: ActionItem[] = [
  { label: "New journal entry", hint: "Finance", href: "/journal-entries", icon: "finance" },
  { label: "New payment voucher", hint: "Treasury", href: "/payment-vouchers", icon: "finance" },
  { label: "Raise purchase order", hint: "Procurement", href: "/procurement", icon: "procurement" },
  { label: "Receive goods", hint: "Inventory", href: "/inventory", icon: "inventory" },
  { label: "Create invoice", hint: "Sales", href: "/sales", icon: "sales" },
  { label: "Process payroll", hint: "Payroll", href: "/hr-payroll", icon: "payroll" },
];

const moduleMenuGroups: Record<string, ModuleMenuGroup[]> = {
  dashboard: [
    {
      label: "Foundation",
      items: [
        { label: "Administration", href: "/administration", description: "Company, security, numbering, workflows" },
        { label: "Tax", href: "/tax", description: "Tax codes and filing controls" },
        { label: "Reports", href: "/reports", description: "Financial and operational reporting" },
      ],
    },
    {
      label: "Parties",
      items: [
        { label: "CRM", href: "/crm", description: "Customers, onboarding, interactions" },
        { label: "Procurement", href: "/procurement?view=Suppliers", description: "Suppliers and vendor readiness" },
        { label: "Inventory", href: "/inventory?view=Items", description: "Items and warehouse master data" },
        { label: "Payroll / HR", href: "/hr-payroll?view=Employees", description: "Employees and payroll readiness" },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Finance", href: "/finance", description: "Ledgers, journals, payables, cash" },
        { label: "Sales", href: "/sales", description: "Invoices, receipts, customer activity" },
        { label: "Procurement", href: "/procurement", description: "Requisitions, POs, vendor bills" },
        { label: "Inventory", href: "/inventory", description: "Items, warehouses, movements" },
      ],
    },
    {
      label: "Finance & Analysis",
      items: [
        { label: "Journal Entries", href: "/journal-entries", description: "Approval-aware finance posting" },
        { label: "Business Intelligence", href: "/business-intelligence", description: "Live charts and trends" },
        { label: "Financial Management", href: "/financial-management", description: "Leadership finance overview" },
      ],
    },
  ],
  finance: [
    {
      label: "Ledger",
      items: [
        { label: "Dashboard", href: "/finance?view=Dashboard", description: "Finance command overview" },
        { label: "General Ledger", href: "/finance?view=General%20Ledger", description: "Journal impact by account" },
        { label: "Journal Entries", href: "/journal-entries", description: "Manual, approval, and posting workspace" },
        { label: "Payment Vouchers", href: "/payment-vouchers", description: "Treasury approvals, GL posting, and payment execution" },
        { label: "Journals", href: "/finance?view=Journals", description: "Posted and source journals" },
        { label: "Chart of Accounts", href: "/finance", description: "Account structure and control" },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Receivables", href: "/finance?view=Accounts%20Receivable", description: "Open AR and collections" },
        { label: "Payables", href: "/finance?view=Accounts%20Payable", description: "Supplier liabilities" },
        { label: "Bank & Cash", href: "/finance?view=Bank%20%26%20Cash", description: "Cash movement and reconciliation" },
        { label: "Fixed Assets", href: "/fixed-assets", description: "Asset register and depreciation" },
        { label: "Loans", href: "/loans", description: "Facilities, schedules, repayments" },
        { label: "Tax", href: "/tax", description: "VAT, withholding, filing controls" },
      ],
    },
    {
      label: "Reports",
      items: [
        { label: "Financial Management", href: "/financial-management", description: "Leadership finance view" },
        { label: "Trial Balance", href: "/reports?view=Trial%20Balance", description: "Opening, movement, closing" },
        { label: "Account Statements", href: "/reports?view=Account%20Statement", description: "Detailed account activity" },
        { label: "Period Close", href: "/finance?view=Period%20Close", description: "Close checklist and controls" },
      ],
    },
  ],
  sales: [
    {
      label: "Sell",
      items: [
        { label: "Invoices", href: "/sales", description: "Invoice desk and print queue" },
        { label: "Customers", href: "/crm?view=Customers", description: "Customer onboarding and records" },
        { label: "CRM Pipeline", href: "/crm?view=Pipeline", description: "Interactions and follow-ups" },
      ],
    },
    {
      label: "Collections",
      items: [
        { label: "Receipts", href: "/finance?view=Accounts%20Receivable", description: "Cash collections and application" },
        { label: "Statements", href: "/reports?view=Account%20Statement%20Summary", description: "Customer statement summaries" },
        { label: "Tax", href: "/tax", description: "Sales tax treatment" },
      ],
    },
    {
      label: "Reports",
      items: [
        { label: "Sales Reports", href: "/reports", description: "Revenue and invoice reporting" },
        { label: "Business Intelligence", href: "/business-intelligence", description: "Trend and customer insights" },
      ],
    },
  ],
  crm: [
    {
      label: "Customers",
      items: [
        { label: "Onboarding", href: "/crm?view=Customers", description: "Create and classify customers" },
        { label: "Statements", href: "/crm?view=Statements", description: "Aging and balances" },
        { label: "Sales Invoices", href: "/sales", description: "Billing and invoice follow-up" },
      ],
    },
    {
      label: "Insights",
      items: [
        { label: "Pipeline", href: "/crm?view=Pipeline", description: "Stage and next actions" },
        { label: "Reports", href: "/reports", description: "Customer and revenue reports" },
      ],
    },
  ],
  procurement: [
    {
      label: "Buying",
      items: [
        { label: "Dashboard", href: "/procurement?view=Dashboard", description: "Procurement workload" },
        { label: "Requisitions", href: "/procurement?view=Requisitions", description: "Demand intake" },
        { label: "RFQs", href: "/procurement?view=RFQs", description: "Supplier sourcing" },
        { label: "Purchase Orders", href: "/procurement?view=Purchase%20Orders", description: "PO queue and approvals" },
      ],
    },
    {
      label: "Execution",
      items: [
        { label: "Goods Received", href: "/procurement?view=Goods%20Received", description: "Inbound receiving control" },
        { label: "Suppliers", href: "/procurement?view=Suppliers", description: "Supplier reviews and onboarding" },
        { label: "Vendor Bills", href: "/finance?view=Accounts%20Payable", description: "Posted liabilities" },
      ],
    },
    {
      label: "Reports",
      items: [
        { label: "Approvals", href: "/procurement?view=Approvals", description: "Approval workload" },
        { label: "Spend Analysis", href: "/reports", description: "Spend and supplier reporting" },
      ],
    },
  ],
  inventory: [
    {
      label: "Stock",
      items: [
        { label: "Items", href: "/inventory?view=Items", description: "Item master and stock desk" },
        { label: "Warehouses", href: "/inventory?view=Warehouses", description: "Storage locations" },
        { label: "Stock Movements", href: "/inventory?view=Stock%20Movements", description: "Receipts, issues, adjustments" },
        { label: "Transfers", href: "/inventory?view=Transfers", description: "Inter-warehouse movements" },
      ],
    },
    {
      label: "Control",
      items: [
        { label: "Counts", href: "/inventory?view=Counts", description: "Cycle counts and variances" },
        { label: "Reorder Planning", href: "/inventory?view=Reorder%20Planning", description: "Low stock and replenishment" },
        { label: "Valuation", href: "/inventory?view=Valuation", description: "Inventory value and exceptions" },
      ],
    },
    {
      label: "Related",
      items: [
        { label: "Supply Chain", href: "/supply-chain", description: "Demand to fulfillment" },
        { label: "Procurement", href: "/procurement", description: "Inbound supply workflow" },
      ],
    },
  ],
  "hr-payroll": [
    {
      label: "People",
      items: [
        { label: "Dashboard", href: "/hr-payroll?view=Dashboard", description: "Payroll readiness and exceptions" },
        { label: "Employees", href: "/human-resources", description: "Employee directory and records" },
        { label: "Payroll Runs", href: "/hr-payroll?view=Payroll%20Runs", description: "Cycle processing" },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Leave", href: "/hr-payroll?view=Leave", description: "Leave requests and approvals" },
        { label: "Attendance", href: "/hr-payroll?view=Attendance", description: "Attendance exceptions" },
        { label: "Loans", href: "/loans", description: "Employee and facility loans" },
      ],
    },
    {
      label: "Reports",
      items: [
        { label: "Payroll Reports", href: "/reports", description: "Payroll registers and analytics" },
        { label: "Tax", href: "/tax", description: "Statutory liabilities" },
        { label: "HR Workspace", href: "/human-resources", description: "Employee records and readiness" },
      ],
    },
  ],
  reports: [
    {
      label: "Finance Reports",
      items: [
        { label: "Trial Balance", href: "/reports?view=Trial%20Balance", description: "Opening, movement, closing" },
        { label: "Income Statement", href: "/reports?view=Income%20Statement", description: "Revenue, expenses, net result" },
        { label: "Statement of Financial Position", href: "/reports?view=Statement%20of%20Financial%20Position", description: "Assets, liabilities, equity" },
        { label: "Cash Flow Statement", href: "/reports?view=Cash%20Flow%20Statement", description: "Operating, investing, financing" },
        { label: "Statement Summary", href: "/reports?view=Account%20Statement%20Summary", description: "Balances by account" },
        { label: "Account Statement", href: "/reports?view=Account%20Statement", description: "Detailed account lines" },
      ],
    },
    {
      label: "Operational Reports",
      items: [
        { label: "Sales", href: "/sales", description: "Invoice output and print queue" },
        { label: "Procurement", href: "/procurement", description: "PO and supplier reporting" },
        { label: "Inventory", href: "/inventory", description: "Stock movement and valuation" },
      ],
    },
    {
      label: "Exports",
      items: [
        { label: "Business Intelligence", href: "/business-intelligence", description: "Charts and trends" },
        { label: "Financial Management", href: "/financial-management", description: "Leadership finance overview" },
        { label: "Administration", href: "/administration", description: "Audit and system reports" },
      ],
    },
  ],
  administration: [
    {
      label: "Governance",
      items: [
        { label: "Users", href: "/administration?view=Users", description: "Provision and deactivate access" },
        { label: "Roles & Permissions", href: "/administration?view=Roles%20%26%20Permissions", description: "Role matrix and permissions" },
        { label: "Workflow & Approval", href: "/administration?view=Workflow%20%26%20Approval", description: "Approval routing and limits" },
      ],
    },
    {
      label: "Enterprise Setup",
      items: [
        { label: "Organization Setup", href: "/administration?view=Organization%20Setup", description: "Company, branch, logo, numbering" },
        { label: "Security & Audit", href: "/administration?view=Security%20%26%20Audit", description: "MFA, sessions, audit visibility" },
        { label: "System Settings", href: "/administration?view=System%20Settings", description: "Notifications and controls" },
      ],
    },
    {
      label: "Technical",
      items: [
        { label: "Integrations", href: "/administration?view=Integrations", description: "Connected services and health" },
        { label: "Import / Export", href: "/administration?view=Import%20%26%20Export", description: "Bulk data tools" },
        { label: "Companies", href: "/organizations", description: "Company setup and cloning" },
        { label: "Business Intelligence", href: "/business-intelligence", description: "Usage and executive insight" },
      ],
    },
  ],
  "business-intelligence": [
    {
      label: "Analytics",
      items: [
        { label: "Dashboard", href: "/business-intelligence?view=Dashboard", description: "Executive analytics overview" },
        { label: "Financial", href: "/business-intelligence?view=Financial", description: "P&L, cash, working capital" },
        { label: "Operational", href: "/business-intelligence?view=Operational", description: "Operations trend monitoring" },
      ],
    },
    {
      label: "Executive",
      items: [
        { label: "Forecasts", href: "/business-intelligence?view=Forecasts", description: "Forward-looking indicators" },
        { label: "Reports", href: "/reports", description: "Detailed report drill-through" },
        { label: "Financial Management", href: "/financial-management", description: "Leadership financial view" },
      ],
    },
  ],
  tax: [
    {
      label: "Tax Control",
      items: [
        { label: "Tax Codes", href: "/tax", description: "Rates and liability mappings" },
        { label: "Filing Calendar", href: "/tax", description: "Deadlines and obligations" },
        { label: "Tax Activity", href: "/tax", description: "Recent tax postings" },
      ],
    },
    {
      label: "Related",
      items: [
        { label: "Finance", href: "/finance?view=Tax", description: "Finance tax workspace" },
        { label: "Reports", href: "/reports", description: "Tax reporting exports" },
      ],
    },
  ],
};

export function getModuleMenuGroups(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const aliases: Record<string, string> = {
    accounting: "finance",
    purchases: "procurement",
    organizations: "administration",
    "human-resources": "hr-payroll",
    "financial-management": "finance",
    "fixed-assets": "finance",
    loans: "finance",
  };
  return moduleMenuGroups[aliases[segment] ?? segment] ?? [];
}

export const dashboardByRole: Record<
  AppRole,
  {
    hero: string;
    kpis: KpiMetric[];
    alerts: AlertItem[];
    quickActions: ActionItem[];
    timeline: TimelineItem[];
    approvals: ApprovalStep[];
    trend: Array<{ label: string; value: number }>;
  }
> = {
  cfo: {
    hero: "Cash, commitments, approvals, and financial control in one operating view.",
    kpis: [
      { label: "Cash position", value: "$4.82M", delta: "+6.1%", trend: "up", detail: "Across all active bank accounts" },
      { label: "Receivables due", value: "$918K", delta: "14 overdue", trend: "down", detail: "Invoices due in 30 days", status: "Overdue" },
      { label: "Payables due", value: "$604K", delta: "7 approvals", trend: "neutral", detail: "Supplier obligations due this week" },
      { label: "Budget vs actual", value: "96.4%", delta: "Within threshold", trend: "up", detail: "Operating spend against plan" },
    ],
    alerts: [
      { id: "a1", title: "Overdue statutory filing", detail: "VAT filing draft is ready but not submitted.", severity: "critical" },
      { id: "a2", title: "Bank rec variance", detail: "Main operations account has NGN 184,200 unmatched.", severity: "warning" },
      { id: "a3", title: "Capital spend request", detail: "Asset purchase above threshold is waiting for executive approval.", severity: "info" },
    ],
    quickActions: quickCreateActions,
    timeline: [
      { id: "t1", title: "Payment batch released", subtitle: "April vendor batch posted", timestamp: "09:12", user: "Finance Ops", status: "Posted" },
      { id: "t2", title: "Budget revision submitted", subtitle: "West branch OPEX revision", timestamp: "08:40", user: "Controller", status: "Submitted" },
      { id: "t3", title: "Loan repayment recorded", subtitle: "Term facility installment", timestamp: "Yesterday", user: "Treasury", status: "Approved" },
    ],
    approvals: [
      { id: "p1", label: "Capital expenditure", owner: "CEO", status: "Pending" },
      { id: "p2", label: "Quarter close sign-off", owner: "CFO", status: "Submitted" },
      { id: "p3", label: "Payroll release", owner: "HR Director", status: "Approved", timestamp: "10:02" },
    ],
    trend: [
      { label: "Jan", value: 68 },
      { label: "Feb", value: 72 },
      { label: "Mar", value: 74 },
      { label: "Apr", value: 81 },
      { label: "May", value: 79 },
      { label: "Jun", value: 86 },
    ],
  },
  accountant: {
    hero: "Prioritize posting, reconciliation, exceptions, and period readiness.",
    kpis: [
      { label: "Unposted journals", value: "12", delta: "3 high priority", trend: "neutral", detail: "Ready for final review" },
      { label: "Bank rec pending", value: "2", delta: "184 unmatched", trend: "down", detail: "Accounts needing reconciliation" },
      { label: "Supplier bills due", value: "$242K", delta: "9 this week", trend: "neutral", detail: "Accounts payable queue" },
      { label: "Tax deadlines", value: "3", delta: "1 in 48 hrs", trend: "down", detail: "Upcoming compliance obligations" },
    ],
    alerts: [
      { id: "a1", title: "Draft journal out of balance", detail: "JE-1048 has a line mismatch of NGN 2,000.", severity: "critical" },
      { id: "a2", title: "Supplier bill missing attachment", detail: "Two posted bills lack supporting documents.", severity: "warning" },
      { id: "a3", title: "Period lock reminder", detail: "Close checklist is due before 6pm today.", severity: "info" },
    ],
    quickActions: [
      { label: "Post journal", hint: "General ledger", href: "/finance" },
      { label: "Reconcile bank", hint: "Bank & cash", href: "/finance" },
      { label: "Review AP queue", hint: "Payables", href: "/finance" },
    ],
    timeline: [
      { id: "t1", title: "Journal posted", subtitle: "Payroll accrual", timestamp: "11:04", user: "Ada O.", status: "Posted" },
      { id: "t2", title: "Supplier payment reversed", subtitle: "Incorrect beneficiary details", timestamp: "10:18", user: "A. Peters", status: "Reversed" },
      { id: "t3", title: "Invoice matched", subtitle: "Sales invoice SINV-00921", timestamp: "09:35", user: "System", status: "Approved" },
    ],
    approvals: [
      { id: "p1", label: "Manual journal", owner: "Finance Manager", status: "Pending" },
      { id: "p2", label: "Write-off request", owner: "CFO", status: "Submitted" },
    ],
    trend: [
      { label: "Mon", value: 31 },
      { label: "Tue", value: 44 },
      { label: "Wed", value: 35 },
      { label: "Thu", value: 52 },
      { label: "Fri", value: 46 },
    ],
  },
  procurement: {
    hero: "Convert requisitions quickly, keep approvals moving, and stop late deliveries before they spread.",
    kpis: [
      { label: "PR pending conversion", value: "18", delta: "5 urgent", trend: "neutral", detail: "Approved requisitions awaiting PO" },
      { label: "Open RFQs", value: "11", delta: "3 expiring", trend: "down", detail: "Competitive sourcing events" },
      { label: "POs pending approval", value: "7", delta: "2 above threshold", trend: "neutral", detail: "Awaiting finance or admin approval" },
      { label: "Late deliveries", value: "4", delta: "1 critical supplier", trend: "down", detail: "Orders past promised date" },
    ],
    alerts: [
      { id: "a1", title: "Supplier SLA breach", detail: "Prime Industrial missed two committed delivery dates this week.", severity: "critical" },
      { id: "a2", title: "Blanket order spend high", detail: "Packaging materials contract is at 91% utilization.", severity: "warning" },
      { id: "a3", title: "Approval queue clear", detail: "All low-value requisitions are moving within SLA.", severity: "info" },
    ],
    quickActions: [
      { label: "Raise PO", hint: "Purchase order", href: "/procurement" },
      { label: "Review RFQs", hint: "Sourcing", href: "/procurement" },
      { label: "Chase delivery", hint: "Supplier follow-up", href: "/procurement" },
    ],
    timeline: [
      { id: "t1", title: "PO approved", subtitle: "PO-23018 for packaging", timestamp: "13:12", user: "Finance", status: "Approved" },
      { id: "t2", title: "Goods receipt pending", subtitle: "PO-23011 expected at Apapa", timestamp: "12:47", user: "Warehouse", status: "Pending" },
      { id: "t3", title: "RFQ awarded", subtitle: "Laboratory supplies tender", timestamp: "Yesterday", user: "Procurement", status: "Closed" },
    ],
    approvals: [
      { id: "p1", label: "PO above threshold", owner: "CFO", status: "Pending" },
      { id: "p2", label: "Supplier onboarding", owner: "Admin", status: "Submitted" },
    ],
    trend: [
      { label: "Week 1", value: 40 },
      { label: "Week 2", value: 55 },
      { label: "Week 3", value: 49 },
      { label: "Week 4", value: 62 },
    ],
  },
  inventory: {
    hero: "Keep stock accuracy high, respond fast to shortages, and move goods without surprises.",
    kpis: [
      { label: "Low stock items", value: "23", delta: "6 urgent", trend: "down", detail: "Items below reorder level" },
      { label: "Stock variance", value: "1.8%", delta: "Within target", trend: "up", detail: "Cycle count variance rate" },
      { label: "Transfers pending", value: "9", delta: "2 aging", trend: "neutral", detail: "Inter-warehouse transfers in progress" },
      { label: "Damaged stock", value: "$18K", delta: "3 open cases", trend: "down", detail: "Awaiting write-off action" },
    ],
    alerts: [
      { id: "a1", title: "Critical reorder", detail: "Packaging resin will stock out in 2 days.", severity: "critical" },
      { id: "a2", title: "Cycle count mismatch", detail: "West depot count differs by 42 units.", severity: "warning" },
      { id: "a3", title: "Transfer arrival confirmed", detail: "Lekki to Yaba replenishment completed.", severity: "info" },
    ],
    quickActions: [
      { label: "Receive goods", hint: "Goods receipt", href: "/inventory" },
      { label: "Transfer stock", hint: "Inter-warehouse", href: "/inventory" },
      { label: "Record count", hint: "Cycle count", href: "/inventory" },
    ],
    timeline: [
      { id: "t1", title: "Stock transfer posted", subtitle: "TRF-00412 from HQ to Lekki", timestamp: "14:00", user: "Warehouse Lead", status: "Posted" },
      { id: "t2", title: "Damaged stock logged", subtitle: "Batch B-221 with moisture issue", timestamp: "12:13", user: "QC", status: "Submitted" },
      { id: "t3", title: "Cycle count closed", subtitle: "Main warehouse aisle C", timestamp: "Yesterday", user: "Store Officer", status: "Approved" },
    ],
    approvals: [
      { id: "p1", label: "Adjustment write-off", owner: "Finance", status: "Pending" },
      { id: "p2", label: "Emergency transfer", owner: "Ops Manager", status: "Approved", timestamp: "09:08" },
    ],
    trend: [
      { label: "Mon", value: 76 },
      { label: "Tue", value: 74 },
      { label: "Wed", value: 81 },
      { label: "Thu", value: 86 },
      { label: "Fri", value: 79 },
    ],
  },
  hr: {
    hero: "Monitor payroll readiness, exceptions, attendance, and employee commitments.",
    kpis: [
      { label: "Payroll ready", value: "92%", delta: "6 exceptions", trend: "neutral", detail: "Records complete for current cycle" },
      { label: "Leave requests", value: "14", delta: "3 pending approval", trend: "neutral", detail: "Open leave actions" },
      { label: "Attendance anomalies", value: "9", delta: "2 unresolved", trend: "down", detail: "Missing or abnormal entries" },
      { label: "Benefits changes", value: "5", delta: "This week", trend: "neutral", detail: "Employee enrollment updates" },
    ],
    alerts: [
      { id: "a1", title: "Payroll cutoff risk", detail: "Two branch timesheets are still incomplete.", severity: "critical" },
      { id: "a2", title: "Leave balance exception", detail: "Five employees have negative projected leave balance.", severity: "warning" },
      { id: "a3", title: "New hire onboarding", detail: "Three employee records await final document upload.", severity: "info" },
    ],
    quickActions: [
      { label: "Process payroll", hint: "Current cycle", href: "/hr-payroll" },
      { label: "Review leave", hint: "Approvals", href: "/hr-payroll" },
      { label: "Fix attendance", hint: "Exceptions", href: "/hr-payroll" },
    ],
    timeline: [
      { id: "t1", title: "Payslip batch generated", subtitle: "March preliminary run", timestamp: "10:32", user: "Payroll", status: "Submitted" },
      { id: "t2", title: "Leave approved", subtitle: "Annual leave for Chidera N.", timestamp: "09:50", user: "HRBP", status: "Approved" },
      { id: "t3", title: "Employee updated", subtitle: "Bank details changed", timestamp: "Yesterday", user: "HR Admin", status: "Draft" },
    ],
    approvals: [
      { id: "p1", label: "Payroll release", owner: "CFO", status: "Pending" },
      { id: "p2", label: "Promotion salary change", owner: "HR Director", status: "Submitted" },
    ],
    trend: [
      { label: "Week 1", value: 82 },
      { label: "Week 2", value: 86 },
      { label: "Week 3", value: 84 },
      { label: "Week 4", value: 89 },
    ],
  },
  admin: {
    hero: "System controls, user access, approvals, and audit visibility stay centralized here.",
    kpis: [
      { label: "Active users", value: "86", delta: "+4 this week", trend: "up", detail: "Across all branches" },
      { label: "Approval workflows", value: "12", delta: "2 need review", trend: "neutral", detail: "Configured workflows" },
      { label: "Audit alerts", value: "3", delta: "2 high priority", trend: "down", detail: "Sensitive actions flagged" },
      { label: "Integrations", value: "5", delta: "1 degraded", trend: "down", detail: "Connected services monitored" },
    ],
    alerts: [
      { id: "a1", title: "Role conflict", detail: "One user has incompatible approval and posting rights.", severity: "critical" },
      { id: "a2", title: "Sync delay", detail: "Bank feed import is 23 minutes behind.", severity: "warning" },
      { id: "a3", title: "Backup complete", detail: "Nightly backup finished successfully.", severity: "info" },
    ],
    quickActions: [
      { label: "Add user", hint: "Users & roles", href: "/administration" },
      { label: "Review audit logs", hint: "Control", href: "/administration" },
      { label: "Adjust workflow", hint: "Approvals", href: "/administration" },
    ],
    timeline: [
      { id: "t1", title: "Permission updated", subtitle: "AP approver rights changed", timestamp: "11:48", user: "Admin", status: "Approved" },
      { id: "t2", title: "Workflow published", subtitle: "New fixed asset approval chain", timestamp: "10:07", user: "Admin", status: "Posted" },
      { id: "t3", title: "Audit export downloaded", subtitle: "Sensitive actions for March", timestamp: "Yesterday", user: "CFO", status: "Closed" },
    ],
    approvals: [
      { id: "p1", label: "Role exception request", owner: "CFO", status: "Pending" },
      { id: "p2", label: "Integration credential update", owner: "Admin", status: "Approved", timestamp: "07:41" },
    ],
    trend: [
      { label: "Mon", value: 91 },
      { label: "Tue", value: 94 },
      { label: "Wed", value: 92 },
      { label: "Thu", value: 96 },
      { label: "Fri", value: 95 },
    ],
  },
  ceo: {
    hero: "See cash, revenue, approvals, and operational risk without losing drill-down capability.",
    kpis: [
      { label: "Monthly revenue", value: "$2.41M", delta: "+8.2%", trend: "up", detail: "Month to date" },
      { label: "Gross margin", value: "41.8%", delta: "+1.4 pts", trend: "up", detail: "Compared with prior month" },
      { label: "Approvals pending", value: "6", delta: "2 urgent", trend: "neutral", detail: "Executive actions waiting" },
      { label: "Overdue obligations", value: "$119K", delta: "4 cases", trend: "down", detail: "Items requiring executive attention" },
    ],
    alerts: [
      { id: "a1", title: "Margin pressure", detail: "Two major SKUs dipped below target margin this week.", severity: "warning" },
      { id: "a2", title: "High-value approval", detail: "Capex request exceeds delegated limit.", severity: "critical" },
      { id: "a3", title: "Expansion branch live", detail: "Abuja warehouse cutover completed.", severity: "info" },
    ],
    quickActions: [
      { label: "Review approvals", hint: "Executive queue", href: "/dashboard" },
      { label: "Open reports", hint: "Board pack", href: "/reports" },
      { label: "Review spend", hint: "Procurement", href: "/procurement" },
    ],
    timeline: [
      { id: "t1", title: "Board pack published", subtitle: "March management pack", timestamp: "08:30", user: "FP&A", status: "Closed" },
      { id: "t2", title: "Major PO approved", subtitle: "Packaging line upgrade", timestamp: "Yesterday", user: "CEO", status: "Approved" },
      { id: "t3", title: "Cashflow forecast refreshed", subtitle: "13-week outlook", timestamp: "Yesterday", user: "Treasury", status: "Submitted" },
    ],
    approvals: [
      { id: "p1", label: "Capex approval", owner: "CEO", status: "Pending" },
      { id: "p2", label: "Policy exception", owner: "Board Delegate", status: "Submitted" },
    ],
    trend: [
      { label: "Jan", value: 52 },
      { label: "Feb", value: 57 },
      { label: "Mar", value: 61 },
      { label: "Apr", value: 63 },
      { label: "May", value: 67 },
      { label: "Jun", value: 71 },
    ],
  },
};

export const financeViews = ["Dashboard", "General Ledger", "Journals", "Accounts Payable", "Accounts Receivable", "Bank & Cash", "Tax", "Period Close"];
export const procurementViews = ["Dashboard", "Requisitions", "RFQs", "Purchase Orders", "Goods Received", "Suppliers", "Approvals"];
export const inventoryViews = ["Dashboard", "Items", "Warehouses", "Stock Movements", "Transfers", "Counts", "Valuation", "Reorder Planning"];
export const payrollViews = ["Dashboard", "Employees", "Payroll Runs", "Leave", "Attendance", "Benefits"];
export const administrationViews = [
  "Dashboard",
  "Users",
  "Roles & Permissions",
  "Organization Setup",
  "Workflow & Approval",
  "Security & Audit",
  "Notifications",
  "Integrations",
  "System Settings",
];
export const crmViews = ["Dashboard", "Customers", "Interactions", "Pipeline", "Statements", "Insights"];
export const scmViews = ["Dashboard", "Demand", "Procurement", "Inventory", "Fulfillment", "Exceptions"];
export const biViews = ["Dashboard", "Financial", "Operational", "Executive", "Forecasts", "Exports"];
export const financialManagementViews = ["Overview", "Profit & Loss", "Cash Flow", "Working Capital", "Controls", "Insights"];

export const crmInteractions = [
  { id: "CRM-1", customer: "Acme Retail", owner: "Bola S.", stage: "Negotiation", value: "$84,000", nextAction: "Send revised pricing", status: "Pending" as AppStatus },
  { id: "CRM-2", customer: "Northern Foods", owner: "James U.", stage: "Qualified", value: "$42,500", nextAction: "Book product demo", status: "Approved" as AppStatus },
  { id: "CRM-3", customer: "Metro Health", owner: "Sade A.", stage: "Onboarding", value: "$18,300", nextAction: "Upload credit form", status: "Submitted" as AppStatus },
];

export const supplyChainOrders = [
  { id: "SC-1", lane: "Requisition to PO", owner: "Procurement", volume: "18 open", risk: "2 overdue", status: "Pending" as AppStatus },
  { id: "SC-2", lane: "Inbound receipts", owner: "Warehouse", volume: "11 expected", risk: "1 delayed", status: "Approved" as AppStatus },
  { id: "SC-3", lane: "Customer fulfillment", owner: "Logistics", volume: "24 deliveries", risk: "3 at risk", status: "Submitted" as AppStatus },
];

export const biInsights = [
  { id: "BI-1", name: "Gross margin trend", category: "Finance", owner: "FP&A", cadence: "Weekly", status: "Approved" as AppStatus },
  { id: "BI-2", name: "Customer retention watch", category: "CRM", owner: "Sales Ops", cadence: "Weekly", status: "Approved" as AppStatus },
  { id: "BI-3", name: "Supplier SLA risk", category: "Supply Chain", owner: "Procurement", cadence: "Daily", status: "Pending" as AppStatus },
  { id: "BI-4", name: "Payroll readiness trend", category: "HR", owner: "HRIS", cadence: "Monthly", status: "Approved" as AppStatus },
];

export const financeJournals = [
  { id: "JE-1048", date: "2026-03-12", source: "Manual Journal", reference: "Payroll accrual", amount: "$84,200", status: "Draft" as AppStatus, owner: "Ada O.", branch: "HQ" },
  { id: "JE-1047", date: "2026-03-12", source: "Purchase posting", reference: "PO-23018 tax adjustment", amount: "$12,450", status: "Pending" as AppStatus, owner: "System", branch: "Lekki" },
  { id: "JE-1046", date: "2026-03-11", source: "Sales posting", reference: "SINV-00921", amount: "$21,900", status: "Posted" as AppStatus, owner: "System", branch: "HQ" },
  { id: "JE-1045", date: "2026-03-11", source: "Bank reconciliation", reference: "March settlement difference", amount: "$5,180", status: "Rejected" as AppStatus, owner: "A. Peters", branch: "HQ" },
];

export const financeAuditTrail: TimelineItem[] = [
  { id: "fa1", title: "Journal drafted", subtitle: "JE-1048 created with 4 lines", timestamp: "12 Mar, 09:02", user: "Ada O.", status: "Draft" },
  { id: "fa2", title: "Supporting file attached", subtitle: "Payroll schedule uploaded", timestamp: "12 Mar, 09:05", user: "Ada O." },
  { id: "fa3", title: "Approval requested", subtitle: "Sent to Finance Manager", timestamp: "12 Mar, 09:08", user: "Ada O.", status: "Submitted" },
];

export const financeApprovalChain: ApprovalStep[] = [
  { id: "s1", label: "Prepared", owner: "Ada O.", status: "Approved", timestamp: "09:02" },
  { id: "s2", label: "Reviewed", owner: "Finance Manager", status: "Pending" },
  { id: "s3", label: "Posted", owner: "System", status: "Draft" },
];

export const procurementOrders = [
  { id: "PO-23018", supplier: "Prime Industrial", buyer: "Obi E.", promisedDate: "2026-03-15", amount: "$48,120", status: "Pending" as AppStatus, branch: "HQ" },
  { id: "PO-23017", supplier: "Northline Chemicals", buyer: "Mira K.", promisedDate: "2026-03-14", amount: "$19,440", status: "Approved" as AppStatus, branch: "Lekki" },
  { id: "PO-23016", supplier: "Metro Packaging", buyer: "Obi E.", promisedDate: "2026-03-10", amount: "$8,920", status: "Overdue" as AppStatus, branch: "Apapa" },
  { id: "PO-23015", supplier: "Swift Safety", buyer: "Tobi A.", promisedDate: "2026-03-13", amount: "$3,280", status: "Submitted" as AppStatus, branch: "HQ" },
];

export const inventoryMovements = [
  { id: "MOV-6001", item: "Packaging Resin", warehouse: "HQ", type: "Receipt", quantity: "+120 bags", status: "Posted" as AppStatus, timestamp: "12 Mar, 08:20" },
  { id: "MOV-6000", item: "Industrial Solvent", warehouse: "Lekki", type: "Issue", quantity: "-18 drums", status: "Posted" as AppStatus, timestamp: "12 Mar, 07:52" },
  { id: "MOV-5999", item: "Labels - Blue", warehouse: "Apapa", type: "Transfer", quantity: "+4 boxes", status: "Pending" as AppStatus, timestamp: "11 Mar, 18:04" },
  { id: "MOV-5998", item: "Batch B-221", warehouse: "HQ", type: "Adjustment", quantity: "-42 units", status: "Submitted" as AppStatus, timestamp: "11 Mar, 16:29" },
];

export const reportLibrary = [
  { id: "r1", name: "Cashflow forecast", category: "Finance", owner: "Treasury", cadence: "Daily", status: "Approved" as AppStatus },
  { id: "r2", name: "AP aging", category: "Finance", owner: "Accounts Payable", cadence: "Daily", status: "Approved" as AppStatus },
  { id: "r3", name: "Spend by supplier", category: "Procurement", owner: "Procurement", cadence: "Weekly", status: "Draft" as AppStatus },
  { id: "r4", name: "Stock variance", category: "Inventory", owner: "Warehouse Control", cadence: "Weekly", status: "Approved" as AppStatus },
];

export const payrollRuns = [
  { id: "PAY-2026-03", period: "March 2026", employees: 48, netPay: "$84,200", status: "Pending" as AppStatus, owner: "HR Payroll", payDate: "2026-03-28" },
  { id: "PAY-2026-02", period: "February 2026", employees: 47, netPay: "$82,450", status: "Approved" as AppStatus, owner: "HR Payroll", payDate: "2026-02-28" },
  { id: "PAY-2026-01", period: "January 2026", employees: 46, netPay: "$80,110", status: "Posted" as AppStatus, owner: "HR Payroll", payDate: "2026-01-31" },
];

export const payrollEmployees = [
  { id: "EMP-001", name: "Chidera Nwosu", department: "Finance", location: "Head Office", bankStatus: "Approved" as AppStatus, payGrade: "G6" },
  { id: "EMP-002", name: "Mariam Bello", department: "Operations", location: "Lagos Warehouse", bankStatus: "Approved" as AppStatus, payGrade: "G5" },
  { id: "EMP-003", name: "David Etim", department: "Procurement", location: "Head Office", bankStatus: "Pending" as AppStatus, payGrade: "G5" },
  { id: "EMP-004", name: "Ada Okafor", department: "HR & Payroll", location: "Head Office", bankStatus: "Approved" as AppStatus, payGrade: "G7" },
];
