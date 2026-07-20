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
};

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

export type ProjectWithTasks = Project & { tasks: { id: string; status: TaskStatus }[] };

export function useProjects() {
  return useQuery({
    queryKey: taskKeys.projects,
    queryFn: async (): Promise<ProjectWithTasks[]> => {
      if (isDemoMode()) return demoProjects();
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks:tasks(id, status)')
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
        .select('*, tasks:tasks(id, status)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWithTasks[];
    },
  });
}

export type TaskWithAssignee = Task & {
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

/** Count of unfinished tasks assigned to the given user (for the dashboard). */
export function useMyOpenTaskCount(uid?: string) {
  return useQuery({
    queryKey: ['my_open_tasks', uid],
    enabled: !!uid,
    queryFn: async (): Promise<number> => {
      if (isDemoMode()) return demoMyOpenTaskCount(uid);
      // !inner join + filter so tasks in trashed projects don't count.
      const { count, error } = await supabase
        .from('tasks')
        .select('id, projects!inner(deleted_at)', { count: 'exact', head: true })
        .eq('assignee_id', uid!)
        .neq('status', 'done')
        .is('projects.deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type MyTask = Task & { project: { id: string; name: string } | null };

/** Unfinished tasks assigned to the given user, soonest due first (dashboard). */
export function useMyTasks(uid?: string, limit = 6) {
  return useQuery({
    queryKey: ['my_tasks', uid, limit],
    enabled: !!uid,
    queryFn: async (): Promise<MyTask[]> => {
      if (isDemoMode()) return demoMyTasks(uid, limit);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects!inner(id, name, deleted_at)')
        .eq('assignee_id', uid!)
        .neq('status', 'done')
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
          .select('*, assignee:assignee_id(full_name, avatar_url)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;
      return {
        project: (project ?? null) as Project | null,
        tasks: (tasks ?? []) as unknown as TaskWithAssignee[],
      };
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
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  priority: Priority;
  tags: string[];
};

export function useCreateTask() {
  return useProjectsMutation<TaskInput & { projectName: string }>(async ({ projectName, ...vars }) => {
    if (isDemoMode()) return demoCreateTask(vars);
    const uid = await currentUserId();
    const { data: created, error } = await supabase
      .from('tasks')
      .insert({ ...vars, created_by: uid })
      .select('id')
      .single();
    if (error) throw error;
    if (vars.assignee_id && vars.assignee_id !== uid) {
      await notifyUsers([vars.assignee_id], {
        type: 'task',
        title: 'New task assigned',
        body: `${vars.title} · ${projectName}`,
        data: { projectId: vars.project_id, taskId: created?.id },
      });
    }
  });
}

export function useUpdateTask() {
  return useProjectsMutation<{ id: string } & Partial<Omit<TaskInput, 'project_id'>>>(
    async ({ id, ...patch }) => {
      if (isDemoMode()) return demoUpdateTask(id, patch);
      type PrevTask = { assignee_id: string | null; title: string; project_id: string; project: { name: string } | null };
      let prev: PrevTask | null = null;
      if (patch.assignee_id) {
        const { data } = await supabase
          .from('tasks')
          .select('assignee_id, title, project_id, project:project_id(name)')
          .eq('id', id)
          .single();
        prev = data as unknown as PrevTask | null;
      }
      const { error } = await supabase
        .from('tasks')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      if (patch.assignee_id && prev && patch.assignee_id !== prev.assignee_id) {
        const uid = await currentUserId();
        if (patch.assignee_id !== uid) {
          await notifyUsers([patch.assignee_id], {
            type: 'task',
            title: 'New task assigned',
            body: `${patch.title ?? prev.title} · ${prev.project?.name ?? 'Project'}`,
            data: { projectId: prev.project_id, taskId: id },
          });
        }
      }
    }
  );
}

export function useDeleteTask() {
  return useProjectsMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteTask(id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  });
}
