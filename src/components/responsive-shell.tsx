import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, usePathname } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useAuth } from '@/lib/auth';
import { isDesktopApp } from '@/lib/desktop-updates';
import { useUnreadCount, useNotificationsRealtime } from '@/lib/queries/notifications';
import { registerForPushNotifications } from '@/lib/push';
import { PRIMARY_NAV, SECONDARY_NAV, NAV_SECTIONS, ALL_NAV, type NavItem } from '@/lib/nav-items';
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
    <View className="flex-row items-center gap-2.5">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
        <Icon as={Bot} size={20} className="text-primary-foreground" />
      </View>
      {!compact && (
        <View>
          <Text className="text-base font-extrabold tracking-tight">Gentoo</Text>
          <Text variant="small" className="-mt-0.5">
            FTC Team Hub
          </Text>
        </View>
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
    (i) => (!i.adminOnly || isAdmin) && !(i.hideOnDesktop && isDesktopApp)
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

function TabBarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href as any} asChild>
      <Pressable className="flex-1 items-center justify-center gap-1 py-1.5">
        <Icon
          as={item.icon}
          size={22}
          className={active ? 'text-primary' : 'text-muted-foreground'}
        />
        <Text
          className={cn(
            'text-[11px] font-medium',
            active ? 'text-primary' : 'text-muted-foreground'
          )}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

function MobileHeader({
  pathname,
  unread,
  name,
  avatarUrl,
}: {
  pathname: string;
  unread: number;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const current = ALL_NAV.find((i) => isActiveRoute(i.href, pathname));
  const bell = SECONDARY_NAV.find((i) => i.name === 'notifications')!;
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
      <Text className="text-lg font-bold tracking-tight">{current?.label ?? 'Gentoo'}</Text>
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

export function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { isWide } = useBreakpoint();
  const pathname = usePathname();
  const { profile, isAdmin, session, isDemo } = useAuth();
  const unread = useUnreadCount();
  useNotificationsRealtime();

  // Register this device for push once the member is signed in & approved.
  const userId = session?.user?.id;
  const isApproved = profile?.status === 'approved';
  React.useEffect(() => {
    if (userId && isApproved && !isDemo) registerForPushNotifications(userId);
  }, [userId, isApproved, isDemo]);

  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-background">
        <Sidebar
          pathname={pathname}
          isAdmin={isAdmin}
          unread={unread}
          name={profile?.full_name}
          role={profile?.role}
          avatarUrl={profile?.avatar_url}
        />
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <MobileHeader
        pathname={pathname}
        unread={unread}
        name={profile?.full_name}
        avatarUrl={profile?.avatar_url}
      />
      <View className="flex-1">{children}</View>
      <View className="flex-row border-t border-border bg-card">
        {PRIMARY_NAV.map((item) => (
          <TabBarItem key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
        ))}
      </View>
    </SafeAreaView>
  );
}
