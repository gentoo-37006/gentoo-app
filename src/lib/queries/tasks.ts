import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifyUsers } from '@/lib/notify';
import type { Priority, Project, ProjectStatus, Task, TaskStatus } from '@/lib/types';

export const taskKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
};

async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

export type ProjectWithTasks = Project & { tasks: { id: string; status: TaskStatus }[] };

export function useProjects() {
  return useQuery({
    queryKey: taskKeys.projects,
    queryFn: async (): Promise<ProjectWithTasks[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks:tasks(id, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWithTasks[];
    },
  });
}

export type TaskWithAssignee = Task & {
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

export function useProject(projectId: string) {
  return useQuery({
    queryKey: taskKeys.project(projectId),
    enabled: !!projectId,
    queryFn: async () => {
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
      qc.invalidateQueries({ queryKey: taskKeys.projects });
      qc.invalidateQueries({ queryKey: ['project'] });
    },
  });
}

// ---- Projects ---------------------------------------------------------------

export function useCreateProject() {
  return useProjectsMutation<{ name: string; description?: string; status: ProjectStatus; priority: Priority }>(
    async (vars) => {
      const uid = await currentUserId();
      const { error } = await supabase.from('projects').insert({ ...vars, created_by: uid });
      if (error) throw error;
    }
  );
}

export function useUpdateProject() {
  return useProjectsMutation<{ id: string } & Partial<Pick<Project, 'name' | 'description' | 'status' | 'priority'>>>(
    async ({ id, ...patch }) => {
      const { error } = await supabase
        .from('projects')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function useDeleteProject() {
  return useProjectsMutation<string>(async (id) => {
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
    const uid = await currentUserId();
    const { error } = await supabase.from('tasks').insert({ ...vars, created_by: uid });
    if (error) throw error;
    if (vars.assignee_id && vars.assignee_id !== uid) {
      await notifyUsers([vars.assignee_id], {
        type: 'task',
        title: 'New task assigned',
        body: `${vars.title} · ${projectName}`,
        data: { projectId: vars.project_id },
      });
    }
  });
}

export function useUpdateTask() {
  return useProjectsMutation<{ id: string } & Partial<Omit<TaskInput, 'project_id'>>>(
    async ({ id, ...patch }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function useDeleteTask() {
  return useProjectsMutation<string>(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  });
}
