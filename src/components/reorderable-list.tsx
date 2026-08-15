import * as React from 'react';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useScreenDragController } from '@/components/ui/screen';
import { MobileDragSurface } from '@/components/mobile-drag-surface';
import { cn } from '@/lib/utils';
import { getNativeDropTarget } from '@/lib/native-reorder';
import {
  hapticReorderDrop,
  hapticReorderPickup,
  hapticReorderTargetChange,
} from '@/lib/reorder-haptics';

type PointerDrag = {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  sourceElement: HTMLElement;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
  insertionIndex: number | null;
  moveListener: ((event: PointerEvent) => void) | null;
  endListener: ((event: PointerEvent) => void) | null;
  cancelListener: ((event: PointerEvent) => void) | null;
};

/**
 * Vertical drag-to-reorder list. Web drags with the pointer (a cloned ghost
 * follows the cursor and a line marks the drop point); native uses a press-hold
 * surface with an animated insertion indicator, both hooked into the screen's
 * auto-scroll while dragging.
 */
export function ReorderableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (itemIds: string[]) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  const screenDragController = useScreenDragController();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const nativeIndicatorY = useSharedValue(0);
  const nativeIndicatorOpacity = useSharedValue(0);
  const nativeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: nativeIndicatorOpacity.value,
    transform: [{ translateY: nativeIndicatorY.value }],
  }));
  const pointerDrag = React.useRef<PointerDrag | null>(null);
  const nativeLayouts = React.useRef(new Map<string, { y: number; height: number }>());
  const nativeDrag = React.useRef<{
    itemId: string;
    listTop: number;
    startScrollOffset: number;
    insertionIndex: number;
    targetKey: string | null;
  } | null>(null);
  const suppressNextClick = React.useRef(false);

  React.useEffect(() => {
    if (!draggingId || typeof document === 'undefined') return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.getSelection()?.removeAllRanges();
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggingId]);

  const clearDragVisuals = () => {
    const drag = pointerDrag.current;
    drag?.ghost?.remove();
    drag?.line?.remove();
    if (drag?.moveListener) window.removeEventListener('pointermove', drag.moveListener);
    if (drag?.endListener) window.removeEventListener('pointerup', drag.endListener);
    if (drag?.cancelListener) window.removeEventListener('pointercancel', drag.cancelListener);
    pointerDrag.current = null;
    setDraggingId(null);
  };

  const reorderAt = (itemId: string, insertionIndex: number) => {
    const fromIndex = items.findIndex((item) => item.id === itemId);
    if (fromIndex < 0) return;
    const reordered = [...items];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(insertionIndex, 0, dragged);
    if (reordered.some((item, index) => item.id !== items[index]?.id)) {
      onReorder(reordered.map((item) => item.id));
    }
  };

  const moveNativeDrag = (absoluteY: number, notifyTargetChange = true) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    const contentY =
      absoluteY -
      drag.listTop +
      (screenDragController.getScrollOffset() - drag.startScrollOffset);
    const target = getNativeDropTarget(
      items.map((item) => item.id),
      drag.itemId,
      nativeLayouts.current,
      contentY
    );
    const targetKey = `${target.itemId}:${target.edge}:${target.insertionIndex}`;
    if (notifyTargetChange && drag.targetKey !== null && drag.targetKey !== targetKey) {
      hapticReorderTargetChange();
    }
    drag.targetKey = targetKey;
    drag.insertionIndex = target.insertionIndex;
    const targetLayout = nativeLayouts.current.get(target.itemId);
    if (targetLayout) {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      nativeIndicatorY.value =
        target.edge === 'before'
          ? targetLayout.y - 7
          : targetLayout.y + targetLayout.height + 5;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      nativeIndicatorOpacity.value = 1;
    }
  };

  const startNativeDrag = (itemId: string, absoluteY: number, localY: number) => {
    const layout = nativeLayouts.current.get(itemId);
    if (!layout) return;
    nativeDrag.current = {
      itemId,
      listTop: absoluteY - localY - layout.y,
      startScrollOffset: screenDragController.getScrollOffset(),
      insertionIndex: items.findIndex((item) => item.id === itemId),
      targetKey: null,
    };
    setDraggingId(itemId);
    hapticReorderPickup();
    moveNativeDrag(absoluteY, false);
  };

  const clearNativeDrag = () => {
    nativeDrag.current = null;
    setDraggingId(null);
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
    nativeIndicatorOpacity.value = 0;
  };

  const endNativeDrag = (absoluteY: number) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    moveNativeDrag(absoluteY);
    reorderAt(drag.itemId, drag.insertionIndex);
    hapticReorderDrop();
    clearNativeDrag();
  };

  const startPointerDrag = (event: React.PointerEvent<HTMLElement>, itemId: string) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const drag: PointerDrag = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      sourceElement: event.currentTarget,
      ghost: null,
      line: null,
      insertionIndex: null,
      moveListener: null,
      endListener: null,
      cancelListener: null,
    };
    drag.moveListener = (pointerEvent) => movePointerDrag(pointerEvent);
    drag.endListener = (pointerEvent) => endPointerDrag(pointerEvent);
    drag.cancelListener = (pointerEvent) => {
      if (pointerDrag.current?.pointerId === pointerEvent.pointerId) clearDragVisuals();
    };
    pointerDrag.current = drag;
    window.addEventListener('pointermove', drag.moveListener, { passive: false });
    window.addEventListener('pointerup', drag.endListener);
    window.addEventListener('pointercancel', drag.cancelListener);
  };

  const movePointerDrag = (event: {
    pointerId: number;
    clientX: number;
    clientY: number;
    preventDefault: () => void;
  }) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.ghost && distance < 5) return;

    if (!drag.ghost) {
      const bounds = drag.sourceElement.getBoundingClientRect();
      const ghost = drag.sourceElement.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-reorder-row');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${event.clientX - drag.offsetX}px`,
        top: `${event.clientY - drag.offsetY}px`,
        width: `${bounds.width}px`,
        opacity: '0.65',
        pointerEvents: 'none',
        zIndex: '9999',
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
      });
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.sourceElement.setPointerCapture(event.pointerId);
      setDraggingId(drag.itemId);
    }

    event.preventDefault();
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;

    const listElement = drag.sourceElement.parentElement;
    const allRows = Array.from(
      listElement?.querySelectorAll<HTMLElement>('[data-reorder-row="true"]') ?? []
    );
    const sourceRow = allRows.find((row) => row.dataset.reorderId === drag.itemId);
    const rows = allRows.filter((row) => row.dataset.reorderId !== drag.itemId);
    const sourceIndex = items.findIndex((item) => item.id === drag.itemId);
    const previousRow =
      sourceIndex > 0
        ? allRows.find((row) => row.dataset.reorderId === items[sourceIndex - 1]?.id)
        : undefined;
    let insertionIndex = rows.length;
    let marker: { itemId: string; edge: 'before' | 'after'; insertionIndex: number } | null =
      rows.length > 0
        ? {
            itemId: rows[rows.length - 1].dataset.reorderId!,
            edge: 'after',
            insertionIndex,
          }
        : null;
    const sourceBounds = sourceRow?.getBoundingClientRect();
    const previousBounds = previousRow?.getBoundingClientRect();

    if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === items.length - 1 &&
      event.clientY > sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = { itemId: drag.itemId, edge: 'after', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === 0 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = { itemId: drag.itemId, edge: 'before', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      previousBounds &&
      event.clientY >= previousBounds.top + previousBounds.height / 2 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = { itemId: drag.itemId, edge: 'before', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      event.clientY >= sourceBounds.top &&
      event.clientY <= sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = {
        itemId: drag.itemId,
        edge: event.clientY < sourceBounds.top + sourceBounds.height / 2 ? 'before' : 'after',
        insertionIndex,
      };
    } else {
      for (let index = 0; index < rows.length; index += 1) {
        const bounds = rows[index].getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
          insertionIndex = index;
          marker = {
            itemId: rows[index].dataset.reorderId!,
            edge: 'before',
            insertionIndex,
          };
          break;
        }
      }
    }

    drag.insertionIndex = marker?.insertionIndex ?? null;
    if (marker) {
      const line = drag.line ?? document.createElement('div');
      line.className = 'pointer-events-none fixed z-[9998] h-0.5 bg-primary';
      drag.line = line;
      const target = allRows.find((row) => row.dataset.reorderId === marker.itemId);
      if (target) {
        const targetIndex = allRows.indexOf(target);
        const bounds = target.getBoundingClientRect();
        const neighbor =
          marker.edge === 'before'
            ? allRows[targetIndex - 1]?.getBoundingClientRect()
            : allRows[targetIndex + 1]?.getBoundingClientRect();
        const lineCenter = neighbor
          ? marker.edge === 'before'
            ? (neighbor.bottom + bounds.top) / 2
            : (bounds.bottom + neighbor.top) / 2
          : marker.edge === 'before'
            ? bounds.top
            : bounds.bottom;
        Object.assign(line.style, {
          left: `${bounds.left}px`,
          top: `${lineCenter - 1}px`,
          width: `${bounds.width}px`,
        });
        if (!line.isConnected) document.body.appendChild(line);
      }
    }
  };

  const endPointerDrag = (event: { pointerId: number; preventDefault: () => void }) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.sourceElement.hasPointerCapture(event.pointerId)) {
      drag.sourceElement.releasePointerCapture(event.pointerId);
    }
    if (drag.ghost) {
      event.preventDefault();
      suppressNextClick.current = true;
      setTimeout(() => {
        suppressNextClick.current = false;
      }, 0);
      if (drag.insertionIndex !== null) reorderAt(drag.itemId, drag.insertionIndex);
    }
    clearDragVisuals();
  };

  return (
    <View className="relative w-full gap-3">
      {Platform.OS !== 'web' ? (
        <Animated.View
          className="absolute left-0 right-0 z-[200] h-0.5 bg-primary"
          style={[nativeIndicatorStyle, { pointerEvents: 'none' }]}
        />
      ) : null}
      {items.map((item) =>
        Platform.OS === 'web' ? (
          React.createElement(
            'div',
            {
              key: item.id,
              'data-reorder-row': 'true',
              'data-reorder-id': item.id,
              onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
                startPointerDrag(event, item.id),
              onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
                if (!suppressNextClick.current) return;
                suppressNextClick.current = false;
                event.preventDefault();
                event.stopPropagation();
              },
              className: cn(
                'relative w-full',
                draggingId === item.id && 'cursor-grabbing opacity-40'
              ),
            },
            renderItem(item)
          )
        ) : (
          <View
            key={item.id}
            className="relative w-full"
            style={draggingId === item.id ? { zIndex: 100, elevation: 100 } : undefined}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              nativeLayouts.current.set(item.id, { y, height });
            }}
          >
            <MobileDragSurface
              onStart={(absoluteY, localY) => startNativeDrag(item.id, absoluteY, localY)}
              onMove={moveNativeDrag}
              onEnd={endNativeDrag}
              onCancel={clearNativeDrag}
            >
              {renderItem(item)}
            </MobileDragSurface>
          </View>
        )
      )}
    </View>
  );
}
