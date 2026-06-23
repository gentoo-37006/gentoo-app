import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, usePathname } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { PRIMARY_NAV, SECONDARY_NAV, ALL_NAV, type NavItem } from '@/lib/nav-items';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';

function isActiveRoute(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
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

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
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
            'text-sm font-medium',
            active ? 'text-primary-foreground' : 'text-foreground'
          )}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

function Sidebar({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  const secondary = SECONDARY_NAV.filter((i) => !i.adminOnly || isAdmin);
  return (
    <View className="h-full w-64 border-r border-border bg-card">
      <View className="px-4 py-5">
        <Brand />
      </View>
      <Separator />
      <ScrollView className="flex-1 px-3 py-4" contentContainerClassName="gap-1">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
        ))}
        <View className="my-3">
          <Separator />
        </View>
        {secondary.map((item) => (
          <SidebarLink key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
        ))}
      </ScrollView>
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

function MobileHeader({ pathname }: { pathname: string }) {
  const current = ALL_NAV.find((i) => isActiveRoute(i.href, pathname));
  const bell = SECONDARY_NAV.find((i) => i.name === 'notifications')!;
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
      <Text className="text-lg font-bold tracking-tight">{current?.label ?? 'Gentoo'}</Text>
      <Link href={bell.href as any} asChild>
        <Pressable className="h-9 w-9 items-center justify-center rounded-full active:bg-accent">
          <Icon as={bell.icon} size={22} className="text-foreground" />
        </Pressable>
      </Link>
    </View>
  );
}

export function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { isWide } = useBreakpoint();
  const pathname = usePathname();
  // TODO(phase 2): derive from the authenticated profile.
  const isAdmin = true;

  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-background">
        <Sidebar pathname={pathname} isAdmin={isAdmin} />
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <MobileHeader pathname={pathname} />
      <View className="flex-1">{children}</View>
      <View className="flex-row border-t border-border bg-card">
        {PRIMARY_NAV.map((item) => (
          <TabBarItem key={item.name} item={item} active={isActiveRoute(item.href, pathname)} />
        ))}
      </View>
    </SafeAreaView>
  );
}
