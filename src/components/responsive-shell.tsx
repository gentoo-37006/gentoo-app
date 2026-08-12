import * as React from 'react';
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Link, usePathname } from 'expo-router';
import { Menu, ChevronDown, ClipboardList } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { cn } from '@/lib/utils';
import { NAV_THEME } from '@/lib/theme';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/queries/notifications';
import { usePendingApprovalCount } from '@/lib/queries/profiles';
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

const MOBILE_SIDEBAR_WIDTH = 256;
const MOBILE_SIDEBAR_ANIMATION_MS = 220;
const MOBILE_EDGE_SWIPE_WIDTH = 64;
const MOBILE_OPEN_SWIPE_TRIGGER = 48;
const MOBILE_CLOSE_SWIPE_TRIGGER = 64;
const MOBILE_OPEN_SWIPE_VELOCITY = 0.18;

function isActiveRoute(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const size = count > 99 ? 'h-[22px] w-[22px]' : count > 9 ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5';
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full bg-destructive',
        size,
        className
      )}
    >
      <Text
        className="w-full text-center text-[8px] font-bold text-destructive-foreground"
        numberOfLines={1}
        style={{ includeFontPadding: false, lineHeight: 9, textAlign: 'center' }}
      >
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
  pendingApprovals,
  name,
  role,
  avatarUrl,
}: {
  pathname: string;
  isAdmin: boolean;
  unread: number;
  pendingApprovals: number;
  name?: string | null;
  role?: string;
  avatarUrl?: string | null;
}) {
  const secondary = SECONDARY_NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
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
            badgeCount={
              item.name === 'notifications'
                ? unread
                : item.name === 'admin'
                  ? pendingApprovals
                  : 0
            }
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
          <View className="absolute right-1 top-1">
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
  pendingApprovals,
  name,
  avatarUrl,
  scoutingOpen,
  setScoutingOpen,
}: {
  pathname: string;
  isAdmin: boolean;
  unread: number;
  pendingApprovals: number;
  name?: string | null;
  avatarUrl?: string | null;
  scoutingOpen: boolean;
  setScoutingOpen: (open: boolean) => void;
}) {
  const icons = SECONDARY_NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      (!i.webOnly || Platform.OS === 'web')
  );
  const scoutingActive = SCOUTING_MENU.some((i) => isActiveRoute(i.href, pathname));

  return (
    <View className="border-b border-border bg-card">
      <View className="flex-row items-center px-4 py-2.5">
        <Brand compact />
        <NavDivider />

        {/* General */}
        {[GENERAL_NAV[0], GENERAL_NAV[1], GENERAL_NAV[2]].map((item) => (
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
              badgeCount={
                item.name === 'notifications'
                  ? unread
                  : item.name === 'admin'
                    ? pendingApprovals
                    : 0
              }
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
              <View className="absolute right-1 top-1">
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
  // Sourced from the theme rather than repeated as literals: the gradient has
  // to END on exactly the bg-background the shell paints around it, and a
  // private copy silently drifts the moment --background is retuned.
  const backgroundColor =
    NAV_THEME[colorScheme === 'dark' ? 'dark' : 'light'].colors.background;

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
  const { data: pendingApprovals = 0 } = usePendingApprovalCount(isAdmin);
  const edgeSwipeEnabled = ALL_NAV.some((item) => item.href === pathname);

  // Mobile drawer + desktop scouting dropdown; navigation closes both.
  // Render-time adjustment (not an effect) so closing happens in the same
  // render pass as the route change, without a cascading re-render.
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [scoutingOpen, setScoutingOpen] = React.useState(false);
  const [prevPath, setPrevPath] = React.useState(pathname);
  const menuProgress = useSharedValue(0);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setScoutingOpen(false);
  }

  const animateMenu = React.useCallback(
    (
      toValue: 0 | 1,
      onComplete?: () => void,
      releaseVelocity = 0
    ) => {
      cancelAnimation(menuProgress);
      const remainingDistance =
        Math.abs(toValue - menuProgress.value) * MOBILE_SIDEBAR_WIDTH;
      const normalVelocity =
        MOBILE_SIDEBAR_WIDTH / MOBILE_SIDEBAR_ANIMATION_MS;
      const velocity = Math.max(normalVelocity, Math.abs(releaseVelocity));
      const duration = Math.max(1, Math.round(remainingDistance / velocity));

      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      menuProgress.value = withTiming(toValue, { duration }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      });
    },
    [menuProgress]
  );

  const openMenu = React.useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
    menuProgress.value = 0;
    setMenuVisible(true);
    requestAnimationFrame(() => animateMenu(1));
  }, [animateMenu, menuProgress]);

  const closeMenu = React.useCallback(() => {
    animateMenu(0, () => setMenuVisible(false));
  }, [animateMenu]);

  const previousPath = React.useRef(pathname);
  React.useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (menuVisible) closeMenu();
  }, [closeMenu, menuVisible, pathname]);

  const [edgeSwipeResponder] = React.useState(() =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.pageX - gesture.dx <=
            MOBILE_EDGE_SWIPE_WIDTH &&
          gesture.dx > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (event, gesture) =>
          event.nativeEvent.pageX - gesture.dx <=
            MOBILE_EDGE_SWIPE_WIDTH &&
          gesture.dx > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          menuProgress.value = 0;
          setMenuVisible(true);
        },
        onPanResponderMove: (_event, gesture) => {
          menuProgress.value = Math.max(
            0,
            Math.min(1, gesture.dx / MOBILE_SIDEBAR_WIDTH)
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          if (
            gesture.dx >= MOBILE_OPEN_SWIPE_TRIGGER ||
            menuProgress.value * MOBILE_SIDEBAR_WIDTH >=
              MOBILE_OPEN_SWIPE_TRIGGER ||
            gesture.vx >= MOBILE_OPEN_SWIPE_VELOCITY
          ) {
            animateMenu(1, undefined, gesture.vx);
          } else {
            animateMenu(0, () => setMenuVisible(false));
          }
        },
        onPanResponderTerminate: (_event, gesture) => {
          if (
            gesture.dx >= MOBILE_OPEN_SWIPE_TRIGGER ||
            menuProgress.value * MOBILE_SIDEBAR_WIDTH >=
              MOBILE_OPEN_SWIPE_TRIGGER ||
            gesture.vx >= MOBILE_OPEN_SWIPE_VELOCITY
          ) {
            animateMenu(1, undefined, gesture.vx);
          } else {
            animateMenu(0, () => setMenuVisible(false));
          }
        },
      })
  );

  const closeSwipeGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 10_000])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          cancelAnimation(menuProgress);
        })
        .onUpdate((event) => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          menuProgress.value = Math.max(
            0,
            Math.min(1, 1 + event.translationX / MOBILE_SIDEBAR_WIDTH)
          );
        })
        .onEnd((event) => {
          const shouldClose =
            event.translationX <= -MOBILE_CLOSE_SWIPE_TRIGGER ||
            event.velocityX <= -350;
          const target = shouldClose ? 0 : 1;
          const remainingDistance =
            Math.abs(target - menuProgress.value) * MOBILE_SIDEBAR_WIDTH;
          const normalVelocity =
            MOBILE_SIDEBAR_WIDTH / MOBILE_SIDEBAR_ANIMATION_MS;
          const releaseVelocity = Math.abs(event.velocityX) / 1000;
          const velocity = Math.max(normalVelocity, releaseVelocity);
          const duration = Math.max(
            1,
            Math.round(remainingDistance / velocity)
          );

          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          menuProgress.value = withTiming(
            target,
            { duration },
            (finished) => {
              if (finished && shouldClose) {
                runOnJS(setMenuVisible)(false);
              }
            }
          );
        }),
    [menuProgress]
  );
  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          -MOBILE_SIDEBAR_WIDTH * (1 - menuProgress.value),
      },
    ],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const opacityStart =
      MOBILE_OPEN_SWIPE_TRIGGER / MOBILE_SIDEBAR_WIDTH;
    const visibleProgress = Math.max(
      0,
      (menuProgress.value - opacityStart) / (1 - opacityStart)
    );
    return { opacity: visibleProgress * 0.6 };
  });

  // Register this device for push once the member is signed in & approved.
  const userId = session?.user?.id;
  const isApproved = profile?.status === 'approved';
  React.useEffect(() => {
    if (userId && isApproved && !isDemo) registerForPushNotifications(userId);
  }, [userId, isApproved, isDemo]);

  if (isWide) {
    return (
      <View className="flex-1 bg-background">
        {/* zIndex keeps the dropdown above the click-away backdrop below.
            The top inset is applied HERE rather than by wrapping the branch in
            a SafeAreaView, so the status-bar strip paints the nav's own card
            background instead of a seam above it. Native only in practice —
            insets are 0 on web, where this branch also runs. Without it the
            iPad nav renders under the clock. */}
        <View
          className="z-20 bg-card"
          style={{ paddingTop: safeAreaInsets.top }}
        >
          <TopNav
            pathname={pathname}
            isAdmin={isAdmin}
            unread={unread}
            pendingApprovals={pendingApprovals}
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
          onOpenMenu={openMenu}
        />
        {/* Edge-swipe handlers go on the CONTENT container, never on an
            absolutely-positioned strip. An overlay with pointerEvents="box-only"
            becomes the hit target for its whole box and forwards nothing, so a
            64pt-wide strip down the left edge silently ate every tap in it —
            including ScreenHeader's Back button, which sits at x≈15-59. It only
            bit top-level nav routes, because edgeSwipeEnabled is false anywhere
            else, which is why Back worked from Trash and Notes but not Cables.

            On the container the responder still gets the gesture:
            onMoveShouldSetPanResponderCapture steals an in-progress touch once
            it turns into a horizontal drag, and the handler already requires the
            touch to have STARTED within MOBILE_EDGE_SWIPE_WIDTH of the edge, so
            the geometry gate survives without blocking anything. */}
        <View
          className="flex-1"
          {...(edgeSwipeEnabled ? edgeSwipeResponder.panHandlers : {})}
        >
          {children}
        </View>
        <BottomSafeAreaFade />
      </View>
      <SafeAreaView className="bg-background" edges={['bottom']} />
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeMenu}
      >
        <GestureDetector gesture={closeSwipeGesture}>
          <View className="relative flex-1">
          <Reanimated.View
            className="absolute inset-0 bg-black"
            style={backdropAnimatedStyle}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              className="flex-1"
              onPress={closeMenu}
            />
          </Reanimated.View>
          <Reanimated.View
            className="z-10 h-full w-64 border-r border-border bg-card"
            style={[
              { paddingTop: safeAreaInsets.top },
              sidebarAnimatedStyle,
            ]}
          >
            <Sidebar
              pathname={pathname}
              isAdmin={isAdmin}
              unread={unread}
              pendingApprovals={pendingApprovals}
              name={profile?.full_name}
              role={profile?.role}
              avatarUrl={profile?.avatar_url}
            />
          </Reanimated.View>
          </View>
        </GestureDetector>
      </Modal>
    </SafeAreaView>
  );
}
