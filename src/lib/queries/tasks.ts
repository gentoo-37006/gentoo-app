import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoCreateProject,
  demoCreateTask,
  demoCurrentUserId,
  demoDeleteProject,
  demoDeleteTask,
  demoMyOpenTaskCount,
  demoMyTasks,
  demoProject,
  demoProjects,
  demoReorderTasks,
  demoRestoreProject,
  demoTrashedProjects,
  demoTrashProject,
  demoUpdateProject,
  demoUpdateTask,
  isDemoMode,
} from '@/lib/demo';
import { notifyUsers } from '@/lib/notify';
import type { Priority, Project, ProjectStatus, Task, TaskStatus } from '@/lib/types';

export const taskKeys = {
  projects: ['projects'] as const,
  trashed: ['projects', 'trashed'] as const,
  project: (id: string) => ['project', id] as const,
  allTasks: ['tasks', 'all'] as const,
};

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

/** Tasks are deleted once done, so the list is exactly the open ones. */
export type ProjectWithTasks = Project & { tasks: { id: string }[] };

export function useProjects() {
  return useQuery({
    queryKey: taskKeys.projects,
    queryFn: async (): Promise<ProjectWithTasks[]> => {
      if (isDemoMode()) return demoProjects();
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks:tasks!tasks_project_id_fkey(id)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWithTasks[];
    },
  });
}

/** Projects that have been moved to trash, newest-trashed first. */
export function useTrashedProjects() {
  return useQuery({
    queryKey: taskKeys.trashed,
    queryFn: async (): Promise<ProjectWithTasks[]> => {
      if (isDemoMode()) return demoTrashedProjects();
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks:tasks!tasks_project_id_fkey(id)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWithTasks[];
    },
  });
}

/** Count of open tasks assigned to the given user (for the dashboard). */
export function useMyOpenTaskCount(uid?: string) {
  return useQuery({
    queryKey: ['my_open_tasks', uid],
    enabled: !!uid,
    queryFn: async (): Promise<number> => {
      if (isDemoMode()) return demoMyOpenTaskCount(uid);
      // !inner join + filter so tasks in trashed projects don't count.
      const { count, error } = await supabase
        .from('tasks')
        .select('id, projects!tasks_project_id_fkey!inner(deleted_at)', { count: 'exact', head: true })
        .contains('assignee_ids', [uid!])
        .is('projects.deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type MyTask = Task & { project: { id: string; name: string } | null };

/** Open tasks assigned to the given user, soonest due first (dashboard). */
export function useMyTasks(uid?: string, limit = 6) {
  return useQuery({
    queryKey: ['my_tasks', uid, limit],
    enabled: !!uid,
    queryFn: async (): Promise<MyTask[]> => {
      if (isDemoMode()) return demoMyTasks(uid, limit);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects!tasks_project_id_fkey!inner(id, name, deleted_at)')
        .contains('assignee_ids', [uid!])
        .is('project.deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as MyTask[];
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: taskKeys.project(projectId),
    enabled: !!projectId,
    queryFn: async () => {
      if (isDemoMode()) return demoProject(projectId);
      const [{ data: project, error: pErr }, { data: tasks, error: tErr }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;
      return {
        project: (project ?? null) as Project | null,
        tasks: (tasks ?? []) as unknown as Task[],
      };
    },
  });
}

export type TaskWithProject = Task & { project: { id: string; name: string } | null };

export function useAllTasks() {
  return useQuery({
    queryKey: taskKeys.allTasks,
    queryFn: async (): Promise<TaskWithProject[]> => {
      if (isDemoMode()) {
        const projects = await demoProjects();
        const projectData = await Promise.all(projects.map((project) => demoProject(project.id)));
        return projectData.flatMap(({ project, tasks }) =>
          tasks.map((task) => ({
            ...task,
            project: project ? { id: project.id, name: project.name } : null,
          }))
        );
      }
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects!tasks_project_id_fkey!inner(id, name, deleted_at)')
        .is('project.deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TaskWithProject[];
    },
  });
}

function useProjectsMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Prefix match also covers taskKeys.trashed (['projects', 'trashed']).
      qc.invalidateQueries({ queryKey: taskKeys.projects });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: taskKeys.allTasks });
      qc.invalidateQueries({ queryKey: ['my_open_tasks'] });
      qc.invalidateQueries({ queryKey: ['my_tasks'] });
    },
  });
}

// ---- Projects ---------------------------------------------------------------

export function useCreateProject() {
  return useProjectsMutation<{ name: string; description?: string; status: ProjectStatus; priority: Priority }>(
    async (vars) => {
      if (isDemoMode()) return demoCreateProject(vars);
      const uid = await currentUserId();
      const { error } = await supabase.from('projects').insert({ ...vars, created_by: uid });
      if (error) throw error;
    }
  );
}

export function useUpdateProject() {
  return useProjectsMutation<{ id: string } & Partial<Pick<Project, 'name' | 'description' | 'status' | 'priority'>>>(
    async ({ id, ...patch }) => {
      if (isDemoMode()) return demoUpdateProject(id, patch);
      const { error } = await supabase
        .from('projects')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
  );
}

/** Move a project to trash (soft delete). Recoverable via useRestoreProject. */
export function useTrashProject() {
  return useProjectsMutation<string>(async (id) => {
    if (isDemoMode()) return demoTrashProject(id);
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  });
}

/** Restore a trashed project back to the active list. */
export function useRestoreProject() {
  return useProjectsMutation<string>(async (id) => {
    if (isDemoMode()) return demoRestoreProject(id);
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  });
}

/** Permanently delete a project (and its tasks, via cascade). Not recoverable. */
export function useDeleteProject() {
  return useProjectsMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteProject(id);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  });
}

// ---- Tasks ------------------------------------------------------------------

export type TaskInput = {
  project_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  assignee_ids: string[];
  blocked_by: string | null;
  blocked_by_project: string | null;
  due_date: string | null;
  priority: Priority;
  tags: string[];
  sort_order?: number;
};

/** Resolves to the new task's id so callers can open its notes page. */
export function useCreateTask() {
  return useProjectsMutation<TaskInput & { projectName: string }, string>(async ({ projectName, ...vars }) => {
    if (isDemoMode()) return demoCreateTask(vars);
    const uid = await currentUserId();
    const { data: created, error } = await supabase
      .from('tasks')
      .insert({ ...vars, created_by: uid })
      .select('id')
      .single();
    if (error) throw error;
    await notifyUsers(
      vars.assignee_ids.filter((a) => a !== uid),
      {
        type: 'task',
        title: 'New task assigned',
        body: `${vars.title} · ${projectName}`,
        data: { projectId: vars.project_id, taskId: created.id },
      }
    );
    return created.id as string;
  });
}

export function useUpdateTask() {
  return useProjectsMutation<{ id: string } & Partial<Omit<TaskInput, 'project_id'>>>(
    async ({ id, ...patch }) => {
      if (isDemoMode()) return demoUpdateTask(id, patch);
      type PrevTask = { assignee_ids: string[]; title: string; project_id: string; project: { name: string } | null };
      let prev: PrevTask | null = null;
      if (patch.assignee_ids?.length) {
        const { data } = await supabase
          .from('tasks')
          .select('assignee_ids, title, project_id, project:projects!tasks_project_id_fkey(name)')
          .eq('id', id)
          .single();
        prev = data as unknown as PrevTask | null;
      }
      const { error } = await supabase
        .from('tasks')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      if (patch.assignee_ids && prev) {
        const uid = await currentUserId();
        const added = patch.assignee_ids.filter((a) => a !== uid && !prev!.assignee_ids.includes(a));
        await notifyUsers(added, {
          type: 'task',
          title: 'New task assigned',
          body: `${patch.title ?? prev.title} · ${prev.project?.name ?? 'Project'}`,
          data: { projectId: prev.project_id, taskId: id },
        });
      }
    }
  );
}

export function useReorderTasks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskIds,
    }: {
      projectId: string;
      taskIds: string[];
    }) => {
      if (isDemoMode()) return demoReorderTasks(taskIds);
      const results = await Promise.all(
        taskIds.map((id, index) =>
          supabase
            .from('tasks')
            .update({ sort_order: (index + 1) * 10 })
            .eq('id', id)
        )
      );
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
    },
    onMutate: async ({ projectId, taskIds }) => {
      const queryKey = taskKeys.project(projectId);
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<{ project: Project | null; tasks: Task[] }>(queryKey);
      if (previous) {
        const positions = new Map(taskIds.map((id, index) => [id, index]));
        qc.setQueryData(queryKey, {
          ...previous,
          tasks: [...previous.tasks].sort(
            (a, b) =>
              (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
          ),
        });
      }
      return { previous, queryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(context.queryKey, context.previous);
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: taskKeys.project(variables.projectId) });
      qc.invalidateQueries({ queryKey: taskKeys.allTasks });
    },
  });
}

export function useDeleteTask() {
  return useProjectsMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteTask(id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  });
}
