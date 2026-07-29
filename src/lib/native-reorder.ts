export type NativeReorderLayout = {
  y: number;
  height: number;
};

export type NativeDropTarget = {
  itemId: string;
  edge: 'before' | 'after';
  insertionIndex: number;
};

export function getNativeDropTarget(
  itemIds: string[],
  sourceId: string,
  layouts: Map<string, NativeReorderLayout>,
  contentY: number
): NativeDropTarget {
  const sourceIndex = itemIds.indexOf(sourceId);
  const sourceLayout = layouts.get(sourceId);
  const previousLayout =
    sourceIndex > 0 ? layouts.get(itemIds[sourceIndex - 1]) : undefined;
  const remaining = itemIds.filter((itemId) => itemId !== sourceId);

  if (
    sourceLayout &&
    sourceIndex === itemIds.length - 1 &&
    contentY > sourceLayout.y + sourceLayout.height
  ) {
    return { itemId: sourceId, edge: 'after', insertionIndex: sourceIndex };
  }

  if (sourceLayout && sourceIndex === 0 && contentY < sourceLayout.y) {
    return { itemId: sourceId, edge: 'before', insertionIndex: sourceIndex };
  }

  if (
    sourceLayout &&
    previousLayout &&
    contentY >= previousLayout.y + previousLayout.height / 2 &&
    contentY < sourceLayout.y
  ) {
    return { itemId: sourceId, edge: 'before', insertionIndex: sourceIndex };
  }

  if (
    sourceLayout &&
    contentY >= sourceLayout.y &&
    contentY <= sourceLayout.y + sourceLayout.height
  ) {
    return {
      itemId: sourceId,
      edge:
        contentY < sourceLayout.y + sourceLayout.height / 2
          ? 'before'
          : 'after',
      insertionIndex: sourceIndex,
    };
  }

  for (let index = 0; index < remaining.length; index += 1) {
    const layout = layouts.get(remaining[index]);
    if (layout && contentY < layout.y + layout.height / 2) {
      return {
        itemId: remaining[index],
        edge: 'before',
        insertionIndex: index,
      };
    }
  }

  if (remaining.length > 0) {
    return {
      itemId: remaining[remaining.length - 1],
      edge: 'after',
      insertionIndex: remaining.length,
    };
  }

  return { itemId: sourceId, edge: 'before', insertionIndex: sourceIndex };
}
