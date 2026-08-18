import * as React from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

type ScreenDragController = {
  setActive: (active: boolean) => void;
  updatePointer: (absoluteY: number) => void;
  getScrollOffset: () => number;
  setAutoScrollListener: (listener: (() => void) | null) => void;
};

const EMPTY_DRAG_CONTROLLER: ScreenDragController = {
  setActive: () => {},
  updatePointer: () => {},
  getScrollOffset: () => 0,
  setAutoScrollListener: () => {},
};
const ScreenDragContext = React.createContext<ScreenDragController>(
  EMPTY_DRAG_CONTROLLER
);
const ScreenDragActiveContext = React.createContext(false);
export type ScreenScrollTracker = {
  scrollY: Animated.Value;
  getOffset: () => number;
  setOffset: (value: number) => void;
  subscribe: (listener: (value: number) => void) => () => void;
};
const EMPTY_SCROLL_Y = new Animated.Value(0);
const ScreenScrollContext = React.createContext<ScreenScrollTracker>({
  scrollY: EMPTY_SCROLL_Y,
  getOffset: () => 0,
  setOffset: () => {},
  subscribe: () => () => {},
});

export function useCreateScreenScrollTracker() {
  const [tracker] = React.useState<ScreenScrollTracker>(() => {
    let offset = 0;
    const listeners = new Set<(value: number) => void>();
    return {
      scrollY: new Animated.Value(0),
      getOffset: () => offset,
      setOffset: (value) => {
        offset = value;
        listeners.forEach((listener) => listener(value));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  });

  React.useEffect(() => {
    const listener = tracker.scrollY.addListener(({ value }) => tracker.setOffset(value));
    return () => tracker.scrollY.removeListener(listener);
  }, [tracker]);

  return tracker;
}

export function ScreenScrollTrackerProvider({
  tracker,
  children,
}: {
  tracker: ScreenScrollTracker;
  children: React.ReactNode;
}) {
  return (
    <ScreenScrollContext.Provider value={tracker}>
      {children}
    </ScreenScrollContext.Provider>
  );
}

export function useScreenDragController() {
  return React.useContext(ScreenDragContext);
}

export function useScreenDragActive() {
  return React.useContext(ScreenDragActiveContext);
}

export function useScreenScrollTracker() {
  return React.useContext(ScreenScrollContext);
}

/**
 * Standard scrollable page container. Fills the viewport width under the top
 * navbar; pass maxWidth (e.g. 'max-w-2xl') for pages that read better narrow.
 */
export function Screen({
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-6xl',
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [dragActive, setDragActive] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const contentHeight = React.useRef(0);
  const viewportHeight = React.useRef(0);
  const pointerY = React.useRef<number | null>(null);
  const autoScrollTimer = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const autoScrollListener = React.useRef<(() => void) | null>(null);
  const scrollTracker = useCreateScreenScrollTracker();

  const stopAutoScroll = () => {
    if (autoScrollTimer.current === null) return;
    clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = null;
  };

  const autoScrollStep = React.useEffectEvent(() => {
    const y = pointerY.current;
    if (y === null) return;

    const edgeSize = 96;
    let ratio = 0;
    if (y < edgeSize) {
      ratio = -Math.min(1, (edgeSize - y) / edgeSize);
    } else if (y > windowHeight - edgeSize) {
      ratio = Math.min(1, (y - (windowHeight - edgeSize)) / edgeSize);
    }
    if (ratio === 0) return;

    const maxOffset = Math.max(0, contentHeight.current - viewportHeight.current);
    const speed = Math.sign(ratio) * 20 * Math.abs(ratio) ** 2;
    const nextOffset = Math.max(
      0,
      Math.min(maxOffset, scrollTracker.getOffset() + speed)
    );
    if (nextOffset === scrollTracker.getOffset()) return;

    scrollTracker.setOffset(nextOffset);
    scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
    autoScrollListener.current?.();
  });

  const setControllerActive = React.useEffectEvent((active: boolean) => {
    scrollRef.current?.setNativeProps({ scrollEnabled: !active });
    setDragActive(active);
    if (!active) {
      pointerY.current = null;
      autoScrollListener.current = null;
      stopAutoScroll();
      return;
    }
    if (autoScrollTimer.current === null) {
      autoScrollTimer.current = setInterval(autoScrollStep, 16);
    }
  });

  const dragController: ScreenDragController = {
    setActive: setControllerActive,
    updatePointer: (absoluteY) => {
      pointerY.current = absoluteY;
    },
    getScrollOffset: scrollTracker.getOffset,
    setAutoScrollListener: (listener) => {
      autoScrollListener.current = listener;
    },
  };

  React.useEffect(() => stopAutoScroll, []);

  return (
    <ScreenDragContext.Provider value={dragController}>
      <ScreenDragActiveContext.Provider value={dragActive}>
        <ScreenScrollTrackerProvider tracker={scrollTracker}>
          <Animated.ScrollView
            ref={scrollRef}
            className={cn('flex-1 bg-background', className)}
            contentContainerStyle={{ alignItems: 'center' }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={(_width, height) => {
              contentHeight.current = height;
            }}
            onLayout={(event) => {
              viewportHeight.current = event.nativeEvent.layout.height;
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollTracker.scrollY } } }],
              {
                useNativeDriver: Platform.OS !== 'web',
              }
            )}
            scrollEnabled={!dragActive}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View
              className={cn(
                'w-full gap-5 px-4 py-5 md:px-8 md:py-8',
                maxWidth,
                contentClassName
              )}
            >
              {children}
            </View>
          </Animated.ScrollView>
        </ScreenScrollTrackerProvider>
      </ScreenDragActiveContext.Provider>
    </ScreenDragContext.Provider>
  );
}

export function ScreenHeader({
  title,
  description,
  backHref,
  children,
}: {
  title: string;
  description?: string;
  /** When set, shows a back chevron and provides a fallback for direct visits. */
  backHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      {backHref ? <ScreenBackButton backHref={backHref} /> : null}
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="h2" className="break-words">{title}</Text>
          {description ? <Text variant="muted">{description}</Text> : null}
        </View>
        {children ? <View className="shrink-0 flex-row items-center gap-2">{children}</View> : null}
      </View>
    </View>
  );
}

export function ScreenBackButton({ backHref }: { backHref: string }) {
  const router = useRouter();

  return (
    <Pressable
      className="-ml-1 flex-row items-center gap-1 self-start py-1 active:opacity-70"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(backHref as any);
        }
      }}
    >
      <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
      <Text variant="muted">Back</Text>
    </Pressable>
  );
}
