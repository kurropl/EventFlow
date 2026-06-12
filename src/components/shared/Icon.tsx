'use client';

/* ✦ Lucide-react icon mapper — J.Benitez brand ✦
 * Thin wrapper so existing <Icon name="..." /> calls resolve to lucide icons.
 * Uses lucide-react (already in dependencies) for consistency with admin UI.
 */

import * as Lucide from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
}

const MAP: Record<string, LucideIcon> = {
  // Navigation
  dashboard: Lucide.LayoutDashboard,
  agenda: Lucide.CalendarDays,
  leads: Lucide.UserPlus,
  kanban: Lucide.Kanban,
  clientes: Lucide.Users,
  cobros: Lucide.WalletMinimal,
  invitados: Lucide.UserCheck,
  catalog: Lucide.UtensilsCrossed,
  operations: Lucide.Settings,
  mapa: Lucide.Table,
  webhooks: Lucide.GitBranch,
  proveedores: Lucide.Truck,
  stock: Lucide.Package,
  portal: Lucide.Globe,
  staffing: Lucide.Users,
  logout: Lucide.LogOut,
  menu: Lucide.Menu,
  close: Lucide.X,

  // Actions
  trash: Lucide.Trash2,
  edit: Lucide.Pencil,
  plus: Lucide.Plus,
  search: Lucide.Search,
  download: Lucide.Download,
  info: Lucide.Info,
  spinner: Lucide.LoaderCircle,
  layout: Lucide.LayoutGrid,
  rotate: Lucide.RotateCw,
  user: Lucide.User,
  userCheck: Lucide.UserCheck,
  clipboardList: Lucide.ClipboardList,
  send: Lucide.Send,

  // KPI
  revenue: Lucide.CreditCard,
  pending: Lucide.Clock,
  guests: Lucide.UserCheck,
  conversion: Lucide.TrendingUp,
  calendar: Lucide.Calendar,
  clock: Lucide.Clock,
  cheque: Lucide.FileText,
  food: Lucide.Utensils,
  star: Lucide.Star,
  refresh: Lucide.RefreshCw,
  email: Lucide.Mail,
  phone: Lucide.Phone,
  pin: Lucide.MapPin,

  // Status
  check: Lucide.Check,
  copy: Lucide.Copy,
  x: Lucide.X,
  arrowLeft: Lucide.ArrowLeft,
  arrowRight: Lucide.ArrowRight,
  chevronDown: Lucide.ChevronDown,
  chevronUp: Lucide.ChevronUp,
  external: Lucide.ExternalLink,
  // Dietary / Guest form
  wheat: Lucide.Wheat,
  leaf: Lucide.Leaf,
  droplet: Lucide.Droplets,
  fish: Lucide.Fish,
  alertCircle: Lucide.AlertCircle,
  baby: Lucide.Baby,
  heart: Lucide.Heart,

  // Staffing / Uniforms
  shirt: Lucide.Shirt,
  messageSquare: Lucide.MessageSquare,
  listChecks: Lucide.ListChecks,
  users: Lucide.Users,
  clipboard: Lucide.Clipboard,
  whatsapp: Lucide.MessageCircle,

  // Decorative selection
  flower: Lucide.Flower2,
  candle: Lucide.CandlestickChart,
  apple: Lucide.Apple,
  minimize2: Lucide.Minimize2,

  // Stock / Inventory
  package: Lucide.Package,
  packageCheck: Lucide.PackageCheck,
  layers: Lucide.Layers,
  alertTriangle: Lucide.AlertTriangle,
  circleX: Lucide.CircleX,
  checkCircle: Lucide.CheckCircle,
  'check-circle': Lucide.CheckCircle,
  truck: Lucide.Truck,
  warehouse: Lucide.Warehouse,
  scale: Lucide.Scale,
};

export default function Icon({ name, className = 'w-[18px] h-[18px]' }: IconProps) {
  const LucideIcon = MAP[name];
  if (!LucideIcon) return null;
  return <LucideIcon className={className} />;
}