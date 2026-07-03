import type { LucideIcon } from 'lucide-react-native';
import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  ListChecks,
  CalendarClock,
  Bell,
  Download,
  ShieldCheck,
  Settings,
} from 'lucide-react-native';

export type NavItem = {
  name: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only render for admins. */
  adminOnly?: boolean;
  /** Hide inside the Electron desktop app (e.g. desktop-install downloads). */
  hideOnDesktop?: boolean;
};

/** Primary destinations — shown in the bottom tab bar on phones. */
export const PRIMARY_NAV: NavItem[] = [
  { name: 'index', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'scouting', label: 'Scouting', href: '/scouting', icon: ClipboardList },
  { name: 'talkie', label: 'Talkie', href: '/talkie', icon: Radio },
  { name: 'tasks', label: 'Tasks', href: '/tasks', icon: ListChecks },
  { name: 'schedule', label: 'Schedule', href: '/schedule', icon: CalendarClock },
];

/** Secondary destinations — sidebar footer on wide screens, header/menu on phones. */
export const SECONDARY_NAV: NavItem[] = [
  { name: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'downloads', label: 'Downloads', href: '/downloads', icon: Download, hideOnDesktop: true },
  { name: 'admin', label: 'Admin', href: '/admin', icon: ShieldCheck, adminOnly: true },
  { name: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
