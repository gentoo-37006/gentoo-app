import * as React from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import {
  buttonTextVariants,
  buttonVariants,
  type ButtonProps,
} from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import {
  DeleteTooltipPortal,
  type DeleteTooltipAnchor,
} from '@/components/ui/delete-tooltip-portal';
import { useDragOverlay } from '@/components/drag-overlay';
import { useScreenScrollTracker } from '@/components/ui/screen';
import { cn } from '@/lib/utils';

const TOOLTIP_VIEWPORT_MARGIN = 8;
const TOOLTIP_ANCHOR_GAP = 8;

function NativeDeleteTooltip({
  anchor,
  text,
  viewportWidth,
  scrollY,
  scrollStart,
}: {
  anchor: DeleteTooltipAnchor;
  text: string;
  viewportWidth: number;
  scrollY: Animated.Value;
  scrollStart: number;
}) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const isMeasured = size.width > 0 && size.height > 0;
  const left = Math.min(
    Math.max(
      anchor.left + anchor.width / 2 - size.width / 2,
      TOOLTIP_VIEWPORT_MARGIN
    ),
    viewportWidth - size.width - TOOLTIP_VIEWPORT_MARGIN
  );

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) {
          setSize({ width, height });
        }
      }}
      className="absolute rounded-sm border border-border bg-popover px-2.5 py-1.5"
      style={{
        left,
        top: anchor.top - size.height - TOOLTIP_ANCHOR_GAP,
        maxWidth: viewportWidth - TOOLTIP_VIEWPORT_MARGIN * 2,
        opacity: isMeasured ? 1 : 0,
        transform: [{ translateY: Animated.subtract(scrollStart, scrollY) }],
      }}
    >
      <Text
        className="select-none text-xs font-semibold text-popover-foreground"
        numberOfLines={1}
        selectable={false}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * Whether the pointer is coarse (touch). `Platform.OS === 'web'` is also true
 * for the web app on a phone or tablet, where there is no Shift key to hold —
 * those users get the same press-again confirmation the native app uses.
 */
function useCoarsePointer() {
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return coarse;
}

function useShiftPressed() {
  const [pressed, setPressed] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const update = (event: KeyboardEvent) => setPressed(event.shiftKey);
    const reset = () => setPressed(false);

    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('blur', reset);
    };
  }, []);

  return pressed;
}

type ConfirmationButtonProps = ButtonProps & {
  confirmationAction: string;
};

type MeasuredTooltipAnchor = DeleteTooltipAnchor & {
  scrollStart: number;
};

export function ConfirmationButton({
  confirmationAction,
  className,
  iconClassName,
  icon,
  variant,
  size,
  label,
  loading,
  disabled,
  children,
  onHoverIn,
  onHoverOut,
  onPress,
  ...pressableProps
}: ConfirmationButtonProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const dragOverlay = useDragOverlay();
  const screenScroll = useScreenScrollTracker();
  const shiftPressed = useShiftPressed();
  const coarsePointer = useCoarsePointer();
  const [hovered, setHovered] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [tooltipAnchor, setTooltipAnchor] = React.useState<MeasuredTooltipAnchor | null>(null);
  const [tooltipSession, setTooltipSession] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = React.useRef<View>(null);
  const tooltipId = React.useId().replace(/[^a-z0-9_-]/gi, '');
  const tooltipAnchorName = `--delete-tooltip-${tooltipId}`;
  const isDisabled = disabled || loading;
  const isWeb = Platform.OS === 'web';
  // Hold-Shift only where a keyboard is a safe assumption; touch web falls back
  // to press-again, or deleting would be impossible there.
  const shiftGate = isWeb && !coarsePointer;
  const webConfirmationEnabled = shiftGate && shiftPressed;
  const textClass = buttonTextVariants({ variant });
  const showTooltip =
    !isDisabled && ((shiftGate && hovered && !shiftPressed) || (!shiftGate && confirming));
  const showDangerIcon =
    !isDisabled && ((shiftGate && hovered && shiftPressed) || (!shiftGate && confirming));
  const tooltipText = shiftGate
    ? `Hold Shift to ${confirmationAction}`
    : `Press again to ${confirmationAction}`;
  const confirmationTextClass = cn(textClass, showDangerIcon && 'text-destructive');

  const measureTooltipAnchor = React.useCallback(() =>
    buttonRef.current?.measureInWindow((left, top, width, height) => {
      const scrollStart = isWeb ? 0 : screenScroll.getOffset();
      setTooltipAnchor((current) => {
        if (
          current?.left === left &&
          current.top === top &&
          current.width === width &&
          current.height === height &&
          current.scrollStart === scrollStart
        ) {
          return current;
        }
        return { left, top, width, height, scrollStart };
      });
    }), [isWeb, screenScroll]);

  React.useEffect(() => {
    if (!isWeb || !buttonRef.current) return;
    const element = buttonRef.current as unknown as HTMLElement;
    element.style.setProperty('anchor-name', tooltipAnchorName);
    return () => {
      element.style.removeProperty('anchor-name');
    };
  }, [isWeb, tooltipAnchorName]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  React.useEffect(() => {
    if (isWeb || !showTooltip || !tooltipAnchor) return;

    dragOverlay.show(
      <NativeDeleteTooltip
        key={tooltipSession}
        anchor={tooltipAnchor}
        text={tooltipText}
        viewportWidth={viewportWidth}
        scrollY={screenScroll.scrollY}
        scrollStart={tooltipAnchor.scrollStart}
      />
    );
    return () => dragOverlay.hide();
  }, [
    dragOverlay,
    isWeb,
    showTooltip,
    tooltipAnchor,
    tooltipSession,
    tooltipText,
    viewportWidth,
    screenScroll.scrollY,
  ]);

  React.useEffect(() => {
    if (!showTooltip) return;

    if (isWeb && typeof window !== 'undefined') {
      const trackAnchor = () => measureTooltipAnchor();
      window.addEventListener('scroll', trackAnchor, true);
      window.addEventListener('resize', trackAnchor);
      return () => {
        window.removeEventListener('scroll', trackAnchor, true);
        window.removeEventListener('resize', trackAnchor);
      };
    }

    return;
  }, [isWeb, measureTooltipAnchor, screenScroll, showTooltip]);

  const resetConfirming = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setConfirming(false);
    setTooltipAnchor(null);
  };

  return (
    <Pressable
      ref={buttonRef}
      {...pressableProps}
      className={cn(
        'relative',
        isWeb && (!shiftGate || webConfirmationEnabled ? 'cursor-pointer' : 'cursor-default'),
        className
      )}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        ...pressableProps.accessibilityState,
        disabled: isDisabled || (shiftGate && !webConfirmationEnabled),
      }}
      onPress={
        shiftGate
          ? webConfirmationEnabled
            ? onPress
            : undefined
          : (event) => {
              if (confirming) {
                resetConfirming();
                onPress?.(event);
                return;
              }

              if (!isWeb) setTooltipSession((current) => current + 1);
              setTooltipAnchor(null);
              measureTooltipAnchor();
              setConfirming(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                timer.current = null;
                setConfirming(false);
                setTooltipAnchor(null);
              }, 1500);
            }
      }
      onHoverIn={(event) => {
        setHovered(true);
        measureTooltipAnchor();
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        setTooltipAnchor(null);
        onHoverOut?.(event);
      }}
    >
      <DeleteTooltipPortal
        visible={isWeb && showTooltip}
        anchor={tooltipAnchor}
        anchorName={tooltipAnchorName}
        text={tooltipText}
      />
      <TextClassContext.Provider value={confirmationTextClass}>
        <View
          pointerEvents="none"
          className={cn(
            buttonVariants({ variant, size }),
            isDisabled && 'opacity-50',
            className && 'w-full',
            className
          )}
          style={
            shiftGate && !webConfirmationEnabled && (variant === 'outline' || variant === 'ghost')
              ? { backgroundColor: 'transparent', opacity: isDisabled ? 0.5 : 1 }
              : undefined
          }
        >
          {loading ? (
            <ActivityIndicator size="small" className={confirmationTextClass} />
          ) : (
            icon && (
              <Icon
                as={icon}
                size={18}
                className={cn(confirmationTextClass, iconClassName)}
              />
            )
          )}
          {label ? <Text className={confirmationTextClass}>{label}</Text> : children}
        </View>
      </TextClassContext.Provider>
    </Pressable>
  );
}

export function DeleteButton(props: ButtonProps) {
  return (
    <ConfirmationButton
      {...props}
      confirmationAction="delete"
      icon={props.icon ?? Trash2}
    />
  );
}
