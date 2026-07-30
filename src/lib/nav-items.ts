import type { LucideIcon } from 'lucide-react-native';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
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
  /** Only render in browser-based navigation. */
  webOnly?: boolean;
};

export type NavSection = { label: string; items: NavItem[] };

/** Day-to-day team work: dashboard, projects, workshop tools. */
export const GENERAL_NAV: NavItem[] = [
  { name: 'index', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'projects', label: 'Projects', href: '/projects', icon: ListChecks },
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

/** Sections for the mobile drawer. */
export const NAV_SECTIONS: NavSection[] = [
  { label: 'General', items: GENERAL_NAV },
  { label: 'Competition', items: COMPETITION_NAV },
];

/** Entries of the "Scouting" dropdown in the desktop top navbar. */
export const SCOUTING_MENU: NavItem[] = [
  { name: 'pit-scouting', label: 'Pit scouting', href: '/scouting/pit', icon: ClipboardList },
  { name: 'match-scouting', label: 'Match scouting', href: '/scouting/matches', icon: CalendarRange },
  { name: 'picklist', label: 'Picklist', href: '/picklist', icon: ListOrdered },
  { name: 'talkie', label: 'Talkie', href: '/talkie', icon: Radio },
];

/** Secondary destinations — sidebar footer, below the sections. */
export const SECONDARY_NAV: NavItem[] = [
  { name: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
  {
    name: 'downloads',
    label: 'Downloads',
    href: '/downloads',
    icon: Download,
    webOnly: true,
  },
  { name: 'admin', label: 'Admin', href: '/admin', icon: ShieldCheck, adminOnly: true },
  { name: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export const ALL_NAV = [...GENERAL_NAV, ...COMPETITION_NAV, ...SECONDARY_NAV];
