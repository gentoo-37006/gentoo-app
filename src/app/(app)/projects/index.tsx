import * as React from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ListChecks, Plus, ChevronRight } from 'lucide-react-native';
import {
  Screen,
  ScreenHeader,
  useScreenDragController,
} from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileDragSurface } from '@/components/mobile-drag-surface';
import { PROJECT_STATUSES, PRIORITIES } from '@/lib/types';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import {
  useProjects,
  useCreateProject,
  useReorderProjects,
  type ProjectWithTasks,
} from '@/lib/queries/tasks';
import { cn } from '@/lib/utils';
import { getNativeDropTarget } from '@/lib/native-reorder';
import {
  hapticReorderDrop,
  hapticReorderPickup,
  hapticReorderTargetChange,
} from '@/lib/reorder-haptics';

const COMPLETED_LINE_HEIGHT =
  Platform.OS === 'web' ? 1 / PixelRatio.get() : StyleSheet.hairlineWidth;
const COMPLETED_LINE_DURATION_MS = 250;

function ProjectCard({
  project,
  onPress,
}: {
  project: ProjectWithTasks;
  onPress: () => void;
}) {
  const [cardHeight, setCardHeight] = React.useState(0);
  const [cardWidth, setCardWidth] = React.useState(0);
  const completed = project.status === 'done';
  const previousCompleted = React.useRef(completed);
  const completedLineProgress = useSharedValue(1);
  const completedLineTop = PixelRatio.roundToNearestPixel(
    (cardHeight - COMPLETED_LINE_HEIGHT) / 2
  );
  const completedLineAnimatedStyle = useAnimatedStyle(() => {
    const progress = completedLineProgress.value;
    const extension = Platform.OS === 'web' ? 16 : cardWidth * 0.015;
    return {
      transform: [
        {
          translateX:
            ((progress - 1) * cardWidth) / 2 - extension * (1 - progress),
        },
        {
          scaleX: progress * (Platform.OS === 'web' ? 1 : 1.03),
        },
      ],
    };
  });
  const open = project.tasks.length;

  React.useLayoutEffect(() => {
    if (completed && !previousCompleted.current) {
      completedLineProgress.value = 0;
      completedLineProgress.value = withTiming(1, {
        duration: COMPLETED_LINE_DURATION_MS,
      });
    } else if (!completed) {
      completedLineProgress.value = 1;
    }
    previousCompleted.current = completed;
  }, [completed, completedLineProgress]);

  return (
    <Pressable
      accessibilityRole="button"
      className="relative w-full overflow-visible rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70"
      onPress={onPress}
      onLayout={(event) => {
        setCardHeight(event.nativeEvent.layout.height);
        setCardWidth(event.nativeEvent.layout.width);
      }}
    >
          <View className={cn('gap-3 p-4', completed && 'opacity-60')}>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-bold">{project.name}</Text>
                {project.description ? (
                  <Text variant="muted" numberOfLines={1}>
                    {project.description}
                  </Text>
                ) : null}
              </View>
              <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Badge variant={projectStatusVariant(project.status)} label={labelOf(PROJECT_STATUSES, project.status)} />
              <Badge variant={priorityVariant(project.priority)} label={labelOf(PRIORITIES, project.priority)} />
            </View>
            <Text variant="small">
              {open === 0 ? 'All clear — no open tasks' : open === 1 ? '1 open task' : `${open} open tasks`}
            </Text>
          </View>
          {completed && cardHeight > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  height: COMPLETED_LINE_HEIGHT,
                  top: completedLineTop,
                },
                completedLineAnimatedStyle,
              ]}
            >
              <View
                className="h-full w-full bg-foreground text-foreground opacity-60"
                style={
                  Platform.OS === 'web'
                    ? ({
                        boxShadow: '-16px 0 0 currentColor, 16px 0 0 currentColor',
                      } as any)
                    : undefined
                }
              />
            </Animated.View>
          ) : null}
    </Pressable>
  );
}

function ProjectList({
  projects,
  onReorder,
  onOpenProject,
}: {
  projects: ProjectWithTasks[];
  onReorder: (projectIds: string[]) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const screenDragController = useScreenDragController();
  type PointerDrag = {
    projectId: string;
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

  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const nativeIndicatorY = useSharedValue(0);
  const nativeIndicatorOpacity = useSharedValue(0);
  const nativeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: nativeIndicatorOpacity.value,
    transform: [{ translateY: nativeIndicatorY.value }],
  }));
  const pointerDrag = React.useRef<PointerDrag | null>(null);
  const nativeLayouts = React.useRef(
    new Map<string, { y: number; height: number }>()
  );
  const nativeDrag = React.useRef<{
    projectId: string;
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

  const reorderAt = (projectId: string, insertionIndex: number) => {
    const fromIndex = projects.findIndex((project) => project.id === projectId);
    if (fromIndex < 0) return;
    const reordered = [...projects];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(insertionIndex, 0, dragged);
    if (reordered.some((project, index) => project.id !== projects[index]?.id)) {
      onReorder(reordered.map((project) => project.id));
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
      projects.map((project) => project.id),
      drag.projectId,
      nativeLayouts.current,
      contentY
    );
    const targetKey = `${target.itemId}:${target.edge}:${target.insertionIndex}`;
    if (
      notifyTargetChange &&
      drag.targetKey !== null &&
      drag.targetKey !== targetKey
    ) {
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

  const startNativeDrag = (
    projectId: string,
    absoluteY: number,
    localY: number
  ) => {
    const layout = nativeLayouts.current.get(projectId);
    if (!layout) return;
    nativeDrag.current = {
      projectId,
      listTop: absoluteY - localY - layout.y,
      startScrollOffset: screenDragController.getScrollOffset(),
      insertionIndex: projects.findIndex((project) => project.id === projectId),
      targetKey: null,
    };
    setDraggingId(projectId);
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
    reorderAt(drag.projectId, drag.insertionIndex);
    hapticReorderDrop();
    clearNativeDrag();
  };

  const startPointerDrag = (
    event: React.PointerEvent<HTMLElement>,
    projectId: string
  ) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const drag: PointerDrag = {
      projectId,
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
      ghost.removeAttribute('data-project-row');
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
      setDraggingId(drag.projectId);
    }

    event.preventDefault();
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;

    const listElement = drag.sourceElement.parentElement;
    const allRows = Array.from(
      listElement?.querySelectorAll<HTMLElement>('[data-project-row="true"]') ?? []
    );
    const sourceRow = allRows.find((row) => row.dataset.projectId === drag.projectId);
    const rows = allRows.filter((row) => row.dataset.projectId !== drag.projectId);
    const sourceIndex = projects.findIndex((project) => project.id === drag.projectId);
    const previousRow =
      sourceIndex > 0
        ? allRows.find((row) => row.dataset.projectId === projects[sourceIndex - 1]?.id)
        : undefined;
    let insertionIndex = rows.length;
    let marker:
      | { projectId: string; edge: 'before' | 'after'; insertionIndex: number }
      | null =
      rows.length > 0
        ? {
            projectId: rows[rows.length - 1].dataset.projectId!,
            edge: 'after',
            insertionIndex,
          }
        : null;
    const sourceBounds = sourceRow?.getBoundingClientRect();
    const previousBounds = previousRow?.getBoundingClientRect();

    if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === projects.length - 1 &&
      event.clientY > sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = { projectId: drag.projectId, edge: 'after', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === 0 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = { projectId: drag.projectId, edge: 'before', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      previousBounds &&
      event.clientY >= previousBounds.top + previousBounds.height / 2 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = { projectId: drag.projectId, edge: 'before', insertionIndex };
    } else if (
      sourceRow &&
      sourceBounds &&
      event.clientY >= sourceBounds.top &&
      event.clientY <= sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = {
        projectId: drag.projectId,
        edge: event.clientY < sourceBounds.top + sourceBounds.height / 2 ? 'before' : 'after',
        insertionIndex,
      };
    } else {
      for (let index = 0; index < rows.length; index += 1) {
        const bounds = rows[index].getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
          insertionIndex = index;
          marker = {
            projectId: rows[index].dataset.projectId!,
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
      const target = allRows.find((row) => row.dataset.projectId === marker.projectId);
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

  const endPointerDrag = (event: {
    pointerId: number;
    preventDefault: () => void;
  }) => {
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
      if (drag.insertionIndex !== null) reorderAt(drag.projectId, drag.insertionIndex);
    }
    clearDragVisuals();
  };

  return (
    <View className="relative w-full gap-3">
      {Platform.OS !== 'web' ? (
        <Animated.View
          pointerEvents="none"
          className="absolute left-0 right-0 z-[200] h-0.5 bg-primary"
          style={nativeIndicatorStyle}
        />
      ) : null}
      {projects.map((project) =>
        Platform.OS === 'web' ? (
          React.createElement(
            'div',
            {
              key: project.id,
              'data-project-row': 'true',
              'data-project-id': project.id,
              onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
                startPointerDrag(event, project.id),
              onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
                if (!suppressNextClick.current) return;
                suppressNextClick.current = false;
                event.preventDefault();
                event.stopPropagation();
              },
              className: cn(
                'relative w-full',
                draggingId === project.id && 'cursor-grabbing opacity-40'
              ),
            },
            <ProjectCard
              project={project}
              onPress={() => onOpenProject(project.id)}
            />
          )
        ) : (
          <View
            key={project.id}
            className="relative w-full"
            style={
              draggingId === project.id
                ? { zIndex: 100, elevation: 100 }
                : undefined
            }
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              nativeLayouts.current.set(project.id, { y, height });
            }}
          >
            <MobileDragSurface
              onStart={(absoluteY, localY) =>
                startNativeDrag(project.id, absoluteY, localY)
              }
              onMove={moveNativeDrag}
              onEnd={endNativeDrag}
              onCancel={clearNativeDrag}
            >
              <ProjectCard
                project={project}
                onPress={() => onOpenProject(project.id)}
              />
            </MobileDragSurface>
          </View>
        )
      )}
    </View>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const reorderProjects = useReorderProjects();

  const addProject = () =>
    createProject.mutate({
      name: 'New project',
      status: 'planning',
      priority: 'medium',
      sort_order:
        Math.max(0, ...(projects ?? []).map((project) => project.sort_order ?? 0)) + 10,
    });

  return (
    <Screen>
      <ScreenHeader title="Projects" description="Organize work into projects and tasks.">
        <Button
          variant="outline"
          size="sm"
          label="Trash"
          accessibilityLabel="View trash"
          onPress={() => router.push('/projects/trash' as any)}
        />
        <Button
          size="sm"
          label="New"
          icon={Plus}
          loading={createProject.isPending}
          disabled={createProject.isPending}
          onPress={addProject}
        />
      </ScreenHeader>

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : (projects ?? []).length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No projects yet"
          description="Create a project, then break it into tasks with assignees, due dates, priorities, and tags."
        >
          <Button
            label="New project"
            icon={Plus}
            loading={createProject.isPending}
            disabled={createProject.isPending}
            onPress={addProject}
          />
        </EmptyState>
      ) : (
        <ProjectList
          projects={projects ?? []}
          onReorder={(projectIds) => reorderProjects.mutate({ projectIds })}
          onOpenProject={(projectId) =>
            router.push(`/projects/${projectId}` as any)
          }
        />
      )}
    </Screen>
  );
}
