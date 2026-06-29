-- ============================================================================
-- 0011_projects_trash: soft-delete ("trash") support for projects
-- ============================================================================

-- Trashed projects keep their row (and their tasks) but are hidden from the
-- active list. deleted_at is null while active, and set when moved to trash.
alter table public.projects add column deleted_at timestamptz;
create index projects_deleted_at_idx on public.projects (deleted_at);

-- Moving to trash and restoring are UPDATEs, already covered by the
-- "projects_update" policy (approved members). Permanently deleting from trash
-- is a DELETE, still covered by "projects_delete" (admins or the creator).
