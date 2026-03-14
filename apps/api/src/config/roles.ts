export type SecurityRole = 'ADMIN' | 'FINANCE' | 'HR' | 'WAREHOUSE' | 'VIEWER';

export const ROLE_PERMISSIONS: Record<SecurityRole, string[]> = {
  ADMIN: ['*'],
  FINANCE: ['transactions', 'reports', 'invoices', 'journals', 'payables', 'receivables'],
  HR: ['employees', 'payroll'],
  WAREHOUSE: ['inventory', 'purchase_orders'],
  VIEWER: ['read_only'],
};

const roleAliases: Record<string, SecurityRole> = {
  admin: 'ADMIN',
  administrator: 'ADMIN',
  superadmin: 'ADMIN',
  'super admin': 'ADMIN',
  cfo: 'FINANCE',
  accountant: 'FINANCE',
  'finance director': 'FINANCE',
  'finance manager': 'FINANCE',
  finance: 'FINANCE',
  hr: 'HR',
  payroll: 'HR',
  'hr manager': 'HR',
  warehouse: 'WAREHOUSE',
  inventory: 'WAREHOUSE',
  procurement: 'WAREHOUSE',
  'store officer': 'WAREHOUSE',
  ceo: 'VIEWER',
  executive: 'VIEWER',
  viewer: 'VIEWER',
};

export function normalizeRoleName(roleName?: string | null): SecurityRole {
  const normalized = (roleName ?? '').trim().toLowerCase();
  return roleAliases[normalized] ?? 'VIEWER';
}

export function normalizeRoleNames(roleNames: string[]): SecurityRole[] {
  const mapped = roleNames.map((role) => normalizeRoleName(role));
  return Array.from(new Set(mapped));
}
