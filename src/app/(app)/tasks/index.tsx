import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListChecks, Plus, ChevronRight } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
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

function ProjectCard({ project }: { project: ProjectWithTasks }) {
  const router = useRouter();
  const open = project.tasks.length;
  return (
    <Pressable className="active:opacity-75" onPress={() => router.push(`/tasks/${project.id}` as any)}>
        <Card className="hover:bg-accent/70">
          <CardContent className="gap-3 p-4">
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
          </CardContent>
        </Card>
    </Pressable>
  );
}

function ProjectList({
  projects,
  onReorder,
}: {
  projects: ProjectWithTasks[];
  onReorder: (projectIds: string[]) => void;
}) {
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
  const [nativeIndicator, setNativeIndicator] = React.useState<{
    projectId: string;
    edge: 'before' | 'after';
  } | null>(null);
  const pointerDrag = React.useRef<PointerDrag | null>(null);
  const nativeLayouts = React.useRef(
    new Map<string, { y: number; height: number }>()
  );
  const nativeDrag = React.useRef<{
    projectId: string;
    listTop: number;
    insertionIndex: number;
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

  const moveNativeDrag = (absoluteY: number) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    const contentY = absoluteY - drag.listTop;
    const remaining = projects.filter((project) => project.id !== drag.projectId);
    let insertionIndex = remaining.length;
    for (let index = 0; index < remaining.length; index += 1) {
      const layout = nativeLayouts.current.get(remaining[index].id);
      if (layout && contentY < layout.y + layout.height / 2) {
        insertionIndex = index;
        break;
      }
    }
    drag.insertionIndex = insertionIndex;
    const target = remaining[insertionIndex];
    setNativeIndicator(
      target
        ? { projectId: target.id, edge: 'before' }
        : remaining.length > 0
          ? { projectId: remaining[remaining.length - 1].id, edge: 'after' }
          : { projectId: drag.projectId, edge: 'before' }
    );
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
      insertionIndex: projects.findIndex((project) => project.id === projectId),
    };
    setDraggingId(projectId);
    moveNativeDrag(absoluteY);
  };

  const clearNativeDrag = () => {
    nativeDrag.current = null;
    setDraggingId(null);
    setNativeIndicator(null);
  };

  const endNativeDrag = (absoluteY: number) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    moveNativeDrag(absoluteY);
    reorderAt(drag.projectId, drag.insertionIndex);
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
    <View className="gap-3">
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
                'relative',
                draggingId === project.id && 'cursor-grabbing opacity-40'
              ),
            },
            <ProjectCard project={project} />
          )
        ) : (
          <View
            key={project.id}
            className={cn('relative', draggingId === project.id && 'opacity-40')}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              nativeLayouts.current.set(project.id, { y, height });
            }}
          >
            {nativeIndicator?.projectId === project.id &&
            nativeIndicator.edge === 'before' ? (
              <View className="absolute -top-[7px] left-0 right-0 z-10 h-0.5 bg-primary" />
            ) : null}
            <MobileDragSurface
              onStart={(absoluteY, localY) =>
                startNativeDrag(project.id, absoluteY, localY)
              }
              onMove={moveNativeDrag}
              onEnd={endNativeDrag}
              onCancel={clearNativeDrag}
            >
              <ProjectCard project={project} />
            </MobileDragSurface>
            {nativeIndicator?.projectId === project.id &&
            nativeIndicator.edge === 'after' ? (
              <View className="absolute -bottom-[7px] left-0 right-0 z-10 h-0.5 bg-primary" />
            ) : null}
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
          onPress={() => router.push('/tasks/trash' as any)}
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
        />
      )}
    </Screen>
  );
}
