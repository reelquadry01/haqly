import {
  Bell,
  Blocks,
  BookOpenText,
  Building2,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  FileBarChart2,
  HandCoins,
  Home,
  Landmark,
  Layers3,
  LineChart,
  Network,
  Package2,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCircle2,
  Users,
  WalletCards,
} from 'lucide-react';
import type { IconName } from '../../lib/erp';

const iconMap = {
  home: Home,
  finance: Landmark,
  financialManagement: LineChart,
  sales: WalletCards,
  crm: UserCircle2,
  procurement: ShoppingCart,
  inventory: Package2,
  scm: Network,
  tax: Percent,
  assets: Layers3,
  payroll: Users,
  reports: FileBarChart2,
  bi: Sparkles,
  admin: ShieldCheck,
  organization: Building2,
  loans: HandCoins,
  search: Search,
  notification: Bell,
  plus: Plus,
  company: Building2,
  branch: Blocks,
  calendar: CalendarRange,
  user: UserCircle2,
} as const;

export function AppIcon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = iconMap[name] ?? BookOpenText;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}

export const utilityIcons = {
  company: Building2,
  branch: Blocks,
  calendar: CalendarRange,
  user: UserCircle2,
  approval: ClipboardCheck,
  money: CreditCard,
};
