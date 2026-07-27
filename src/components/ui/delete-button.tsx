import * as React from 'react';
import {
  ActivityIndicator,
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
import { cn } from '@/lib/utils';

const MOBILE_TOOLTIP_WIDTH = 152;
const TOOLTIP_VIEWPORT_MARGIN = 8;

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

export function DeleteButton({
  className,
  iconClassName,
  icon = Trash2,
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
}: ButtonProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const shiftPressed = useShiftPressed();
  const coarsePointer = useCoarsePointer();
  const [hovered, setHovered] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [tooltipAnchor, setTooltipAnchor] = React.useState<DeleteTooltipAnchor | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = React.useRef<View>(null);
  const isDisabled = disabled || loading;
  const isWeb = Platform.OS === 'web';
  // Hold-Shift only where a keyboard is a safe assumption; touch web falls back
  // to press-again, or deleting would be impossible there.
  const shiftGate = isWeb && !coarsePointer;
  const webDeleteEnabled = shiftGate && shiftPressed;
  const textClass = buttonTextVariants({ variant });
  const showTooltip =
    !isDisabled && ((shiftGate && hovered && !shiftPressed) || (!shiftGate && confirming));
  const showDangerIcon =
    !isDisabled && ((shiftGate && hovered && shiftPressed) || (!shiftGate && confirming));
  const tooltipText = shiftGate ? 'Hold Shift to delete' : 'Press again to delete';
  const confirmationTextClass = cn(textClass, showDangerIcon && 'text-destructive');
  const mobileTooltipLeft = tooltipAnchor
    ? Math.min(
        Math.max(
          tooltipAnchor.left + tooltipAnchor.width / 2 - MOBILE_TOOLTIP_WIDTH / 2,
          TOOLTIP_VIEWPORT_MARGIN
        ),
        viewportWidth - MOBILE_TOOLTIP_WIDTH - TOOLTIP_VIEWPORT_MARGIN
      ) - tooltipAnchor.left
    : 0;

  const measureTooltipAnchor = () =>
    buttonRef.current?.measureInWindow((left, top, width, height) => {
      setTooltipAnchor({ left, top, width, height });
    });

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

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
        isWeb && (!shiftGate || webDeleteEnabled ? 'cursor-pointer' : 'cursor-default'),
        className
      )}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        ...pressableProps.accessibilityState,
        disabled: isDisabled || (shiftGate && !webDeleteEnabled),
      }}
      onPress={
        shiftGate
          ? webDeleteEnabled
            ? onPress
            : undefined
          : (event) => {
              if (confirming) {
                resetConfirming();
                onPress?.(event);
                return;
              }

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
      <DeleteTooltipPortal visible={isWeb && showTooltip} anchor={tooltipAnchor} text={tooltipText} />
      {showTooltip && !isWeb && tooltipAnchor ? (
        <View
          pointerEvents="none"
          className="absolute bottom-full z-50 mb-2 items-center rounded-sm border border-border bg-popover px-2.5 py-1.5"
          style={{ left: mobileTooltipLeft, width: MOBILE_TOOLTIP_WIDTH }}
        >
          <Text
            className="select-none text-xs font-semibold text-popover-foreground"
            numberOfLines={1}
            selectable={false}
          >
            {tooltipText}
          </Text>
        </View>
      ) : null}
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
            shiftGate && !webDeleteEnabled && (variant === 'outline' || variant === 'ghost')
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
