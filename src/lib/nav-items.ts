import type { LucideIcon } from 'lucide-react-native';
import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  ListChecks,
  ListOrdered,
  CalendarClock,
  Cable,
  Trophy,
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

export type NavSection = { label: string; items: NavItem[] };

/** Day-to-day team work: dashboard, projects, workshop tools. */
export const GENERAL_NAV: NavItem[] = [
  { name: 'index', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'tasks', label: 'Tasks', href: '/tasks', icon: ListChecks },
  { name: 'cables', label: 'Cables', href: '/cables', icon: Cable },
];

/** Event-day operations: live dashboard, scouting, picklist, comms, pit duty. */
export const COMPETITION_NAV: NavItem[] = [
  { name: 'competition', label: 'Competition', href: '/competition', icon: Trophy },
  { name: 'scouting', label: 'Scouting', href: '/scouting', icon: ClipboardList },
  { name: 'picklist', label: 'Picklist', href: '/picklist', icon: ListOrdered },
  { name: 'talkie', label: 'Talkie', href: '/talkie', icon: Radio },
  { name: 'schedule', label: 'Pit schedule', href: '/schedule', icon: CalendarClock },
];

/** Sidebar sections on wide screens. */
export const NAV_SECTIONS: NavSection[] = [
  { label: 'General', items: GENERAL_NAV },
  { label: 'Competition', items: COMPETITION_NAV },
];

/** Primary destinations — shown in the bottom tab bar on phones. */
export const PRIMARY_NAV: NavItem[] = [
  GENERAL_NAV[0], // Dashboard
  GENERAL_NAV[1], // Tasks
  COMPETITION_NAV[0], // Competition
  COMPETITION_NAV[1], // Scouting
  COMPETITION_NAV[2], // Picklist
];

/** Secondary destinations — sidebar footer on wide screens, header/menu on phones. */
export const SECONDARY_NAV: NavItem[] = [
  { name: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'downloads', label: 'Downloads', href: '/downloads', icon: Download, hideOnDesktop: true },
  { name: 'admin', label: 'Admin', href: '/admin', icon: ShieldCheck, adminOnly: true },
  { name: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export const ALL_NAV = [...GENERAL_NAV, ...COMPETITION_NAV, ...SECONDARY_NAV];
