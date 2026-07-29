import * as React from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Link, usePathname } from 'expo-router';
import { Menu, ChevronDown, ClipboardList } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useAuth } from '@/lib/auth';
import { isDesktopApp } from '@/lib/desktop-updates';
import { useUnreadCount } from '@/lib/queries/notifications';
import { registerForPushNotifications } from '@/lib/push';
import {
  GENERAL_NAV,
  COMPETITION_NAV,
  SCOUTING_MENU,
  SECONDARY_NAV,
  NAV_SECTIONS,
  ALL_NAV,
  type NavItem,
} from '@/lib/nav-items';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Avatar } from '@/components/ui/avatar';

function isActiveRoute(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <View
      className={cn(
        'min-w-[18px] items-center justify-center rounded-sm bg-destructive px-1.5 py-0.5',
        className
      )}
    >
      <Text className="text-[10px] font-bold text-destructive-foreground">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <View>
      <Text className="text-lg font-extrabold tracking-tight">Gentoo</Text>
      {!compact && (
        <Text variant="small" className="-mt-0.5">
          FTC Team Hub
        </Text>
      )}
    </View>
  );
}

function SidebarLink({
  item,
  active,
  badgeCount = 0,
}: {
  item: NavItem;
  active: boolean;
  badgeCount?: number;
}) {
  return (
    <Link href={item.href as any} asChild>
      <Pressable
        className={cn(
          'flex-row items-center gap-3 rounded-lg px-3 py-2.5',
          active ? 'bg-primary' : 'active:bg-accent'
        )}
      >
        <Icon
          as={item.icon}
          size={20}
          className={active ? 'text-primary-foreground' : 'text-muted-foreground'}
        />
        <Text
          className={cn(
            'flex-1 text-sm font-medium',
            active ? 'text-primary-foreground' : 'text-foreground'
          )}
        >
          {item.label}
        </Text>
        {!active ? <CountBadge count={badgeCount} /> : null}
      </Pressable>
    </Link>
  );
}

function UserChip({ name, role, avatarUrl }: { name?: string | null; role?: string; avatarUrl?: string | null }) {
  return (
    <Link href={'/settings' as any} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-lg p-2 active:bg-accent">
        <Avatar name={name} uri={avatarUrl} size={36} />
        <View className="flex-1">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {name ?? 'Member'}
          </Text>
          <Text variant="small" className="capitalize">
            {role ?? 'member'}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function Sidebar({
  pathname,
  isAdmin,
  unread,
  name,
  role,
  avatarUrl,
}: {
  pathname: string;
  isAdmin: boolean;
  unread: number;
  name?: string | null;
  role?: string;
  avatarUrl?: string | null;
}) {
  const secondary = SECONDARY_NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      !(i.hideOnDesktop && isDesktopApp) &&
      (!i.webOnly || Platform.OS === 'web')
  );
  return (
    <View className="h-full w-64 border-r border-border bg-card">
      <View className="px-4 py-5">
        <Brand />
      </View>
      <Separator />
      <ScrollView className="flex-1 px-3 py-4" contentContainerClassName="gap-1">
        {NAV_SECTIONS.map((section, i) => (
          <View key={section.label} className={cn('gap-1', i > 0 && 'mt-4')}>
            <Text variant="label" className="px-3 pb-1 text-muted-foreground">
              {section.label}
            </Text>
            {section.items.map((item) => (
              <SidebarLink key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
            ))}
          </View>
        ))}
        <View className="my-3">
          <Separator />
        </View>
        {secondary.map((item) => (
          <SidebarLink
            key={item.name}
            item={item}
            active={isActiveRoute(item.href, pathname)}
            badgeCount={item.name === 'notifications' ? unread : 0}
          />
        ))}
      </ScrollView>
      <Separator />
      <View className="p-3">
        <UserChip name={name} role={role} avatarUrl={avatarUrl} />
      </View>
    </View>
  );
}

function NavBarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href as any} asChild>
      <Pressable
        className={cn(
          'flex-row items-center gap-2 rounded-sm px-3 py-2',
          active ? 'bg-primary' : 'hover:bg-accent active:bg-accent'
        )}
      >
        <Icon
          as={item.icon}
          size={16}
          className={active ? 'text-primary-foreground' : 'text-muted-foreground'}
        />
        <Text
          className={cn(
            'text-[13px] font-semibold',
            active ? 'text-primary-foreground' : 'text-foreground'
          )}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

function NavBarIcon({ item, badgeCount = 0 }: { item: NavItem; badgeCount?: number }) {
  return (
    <Link href={item.href as any} asChild>
      <Pressable
        accessibilityLabel={item.label}
        className="h-9 w-9 items-center justify-center rounded-sm hover:bg-accent active:bg-accent"
      >
        <Icon as={item.icon} size={18} className="text-muted-foreground" />
        {badgeCount > 0 ? (
          <View className="absolute -right-0.5 -top-0.5">
            <CountBadge count={badgeCount} />
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

function NavDivider() {
  return <View className="mx-2 h-5 w-px bg-border" />;
}

function TopNav({
  pathname,
  isAdmin,
  unread,
  name,
  avatarUrl,
  scoutingOpen,
  setScoutingOpen,
}: {
  pathname: string;
  isAdmin: boolean;
  unread: number;
  name?: string | null;
  avatarUrl?: string | null;
  scoutingOpen: boolean;
  setScoutingOpen: (open: boolean) => void;
}) {
  const icons = SECONDARY_NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      !(i.hideOnDesktop && isDesktopApp) &&
      (!i.webOnly || Platform.OS === 'web')
  );
  const scoutingActive = SCOUTING_MENU.some((i) => isActiveRoute(i.href, pathname));

  return (
    <View className="border-b border-border bg-card">
      <View className="flex-row items-center px-4 py-2.5">
        <Brand compact />
        <NavDivider />

        {/* General */}
        {[GENERAL_NAV[0], GENERAL_NAV[1]].map((item) => (
          <NavBarLink key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
        ))}
        <NavDivider />

        {/* Competition */}
        <NavBarLink item={COMPETITION_NAV[0]} active={isActiveRoute(COMPETITION_NAV[0].href, pathname)} />
        <View className="relative">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scouting menu"
            onPress={() => setScoutingOpen(!scoutingOpen)}
            className={cn(
              'flex-row items-center gap-2 rounded-sm px-3 py-2',
              scoutingActive ? 'bg-primary' : scoutingOpen ? 'bg-accent' : 'hover:bg-accent active:bg-accent'
            )}
          >
            <Icon
              as={ClipboardList}
              size={16}
              className={scoutingActive ? 'text-primary-foreground' : 'text-muted-foreground'}
            />
            <Text
              className={cn(
                'text-[13px] font-semibold',
                scoutingActive ? 'text-primary-foreground' : 'text-foreground'
              )}
            >
              Scouting
            </Text>
            <Icon
              as={ChevronDown}
              size={14}
              className={scoutingActive ? 'text-primary-foreground' : 'text-muted-foreground'}
            />
          </Pressable>
          {scoutingOpen ? (
            <View className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-popover p-1">
              {SCOUTING_MENU.map((item) => {
                const active = isActiveRoute(item.href, pathname);
                return (
                  <Link key={item.name} href={item.href as any} asChild>
                    <Pressable
                      className={cn(
                        'flex-row items-center gap-2.5 rounded-sm px-3 py-2',
                        active ? 'bg-primary' : 'hover:bg-accent active:bg-accent'
                      )}
                    >
                      <Icon
                        as={item.icon}
                        size={16}
                        className={active ? 'text-primary-foreground' : 'text-muted-foreground'}
                      />
                      <Text
                        className={cn(
                          'text-[13px] font-semibold',
                          active ? 'text-primary-foreground' : 'text-foreground'
                        )}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ) : null}
        </View>
        <NavBarLink item={COMPETITION_NAV[4]} active={isActiveRoute(COMPETITION_NAV[4].href, pathname)} />

        <View className="flex-1" />

        {/* Secondary as icons */}
        <View className="flex-row items-center gap-0.5">
          {icons.map((item) => (
            <NavBarIcon
              key={item.name}
              item={item}
              badgeCount={item.name === 'notifications' ? unread : 0}
            />
          ))}
          <Link href={'/settings' as any} asChild>
            <Pressable
              className="ml-2 h-9 w-9 items-center justify-center rounded-full hover:bg-accent active:bg-accent"
              accessibilityLabel="Profile settings"
            >
              <Avatar name={name} uri={avatarUrl} size={30} />
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

function MobileHeader({
  pathname,
  unread,
  name,
  avatarUrl,
  onOpenMenu,
}: {
  pathname: string;
  unread: number;
  name?: string | null;
  avatarUrl?: string | null;
  onOpenMenu: () => void;
}) {
  const current = ALL_NAV.find((i) => isActiveRoute(i.href, pathname));
  const bell = SECONDARY_NAV.find((i) => i.name === 'notifications')!;
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={onOpenMenu}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-sm active:bg-accent"
        >
          <Icon as={Menu} size={22} className="text-foreground" />
        </Pressable>
        <Text className="text-lg font-bold tracking-tight">{current?.label ?? 'Gentoo'}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Link href={bell.href as any} asChild>
          <Pressable className="h-9 w-9 items-center justify-center rounded-sm active:bg-accent">
            <Icon as={bell.icon} size={22} className="text-foreground" />
            {unread > 0 ? (
              <View className="absolute right-0.5 top-0.5">
                <CountBadge count={unread} />
              </View>
            ) : null}
          </Pressable>
        </Link>
        <Link href={'/settings' as any} asChild>
          <Pressable className="ml-1">
            <Avatar name={name} uri={avatarUrl} size={32} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function BottomSafeAreaFade() {
  const { colorScheme } = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#121212' : '#FAFAFA';

  return (
    <View
      pointerEvents="none"
      className="absolute bottom-0 left-0 right-0 z-10 h-6"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="bottom-safe-area-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={backgroundColor} stopOpacity="0" />
            <Stop offset="1" stopColor={backgroundColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bottom-safe-area-fade)" />
      </Svg>
    </View>
  );
}

export function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { isWide } = useBreakpoint();
  const safeAreaInsets = useSafeAreaInsets();
  const pathname = usePathname();
  const { profile, isAdmin, session, isDemo } = useAuth();
  const unread = useUnreadCount();

  // Mobile drawer + desktop scouting dropdown; navigation closes both.
  // Render-time adjustment (not an effect) so closing happens in the same
  // render pass as the route change, without a cascading re-render.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scoutingOpen, setScoutingOpen] = React.useState(false);
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
    setScoutingOpen(false);
  }

  // Register this device for push once the member is signed in & approved.
  const userId = session?.user?.id;
  const isApproved = profile?.status === 'approved';
  React.useEffect(() => {
    if (userId && isApproved && !isDemo) registerForPushNotifications(userId);
  }, [userId, isApproved, isDemo]);

  if (isWide) {
    return (
      <View className="flex-1 bg-background">
        {/* zIndex keeps the dropdown above the click-away backdrop below. */}
        <View className="z-20">
          <TopNav
            pathname={pathname}
            isAdmin={isAdmin}
            unread={unread}
            name={profile?.full_name}
            avatarUrl={profile?.avatar_url}
            scoutingOpen={scoutingOpen}
            setScoutingOpen={setScoutingOpen}
          />
        </View>
        <View className="z-0 flex-1">{children}</View>
        {scoutingOpen ? (
          <Pressable
            accessibilityLabel="Close menu"
            className="absolute bottom-0 left-0 right-0 top-0 z-10 cursor-default"
            onPress={() => setScoutingOpen(false)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-card" edges={['top']}>
      <View className="flex-1 bg-background">
        <MobileHeader
          pathname={pathname}
          unread={unread}
          name={profile?.full_name}
          avatarUrl={profile?.avatar_url}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <View className="flex-1">{children}</View>
        <BottomSafeAreaFade />
      </View>
      <SafeAreaView className="bg-background" edges={['bottom']} />
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <View className="flex-1 flex-row">
          <View
            className="w-64 bg-card"
            style={{ paddingTop: safeAreaInsets.top }}
          >
            <Sidebar
              pathname={pathname}
              isAdmin={isAdmin}
              unread={unread}
              name={profile?.full_name}
              role={profile?.role}
              avatarUrl={profile?.avatar_url}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            className="flex-1 bg-black/60"
            onPress={() => setMenuOpen(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
