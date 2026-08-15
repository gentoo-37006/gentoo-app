import * as React from 'react';
import { View } from 'react-native';
import { createPortal } from 'react-dom';
import { Text } from '@/components/ui/text';

export type DeleteTooltipAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function DeleteTooltipPortal({
  visible,
  anchor,
  anchorName,
  text,
}: {
  visible: boolean;
  anchor: DeleteTooltipAnchor | null;
  anchorName: string;
  text: string;
}) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const isMeasured = size.width > 0 && size.height > 0;

  if (!visible || !anchor || typeof document === 'undefined') return null;

  const supportsAnchorPositioning =
    typeof CSS !== 'undefined' && CSS.supports('anchor-name: --delete-tooltip');

  if (supportsAnchorPositioning) {
    return createPortal(
      React.createElement(
        'div',
        {
          className:
            'fixed z-[9999] select-none whitespace-nowrap rounded-sm border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-popover-foreground',
          style: {
            positionAnchor: anchorName,
            left: 'anchor(center)',
            top: 'anchor(top)',
            transform: 'translate(-50%, calc(-100% - 8px))',
            pointerEvents: 'none',
          } as React.CSSProperties,
        },
        text
      ),
      document.body
    );
  }

  return createPortal(
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
      className="fixed z-[9999] rounded-sm border border-border bg-popover px-2.5 py-1.5"
      style={{
        left: anchor.left + anchor.width / 2 - size.width / 2,
        top: anchor.top - size.height - 8,
        opacity: isMeasured ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <Text
        className="select-none text-xs font-semibold text-popover-foreground"
        numberOfLines={1}
        selectable={false}
      >
        {text}
      </Text>
    </View>,
    document.body
  );
}
