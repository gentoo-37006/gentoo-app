-- ============================================================================
-- 0008_pit_shifts: pit-duty rotation schedule
-- ============================================================================

create table public.pit_shifts (
  id          uuid primary key default gen_random_uuid(),
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  assignee_id uuid references public.profiles (id) on delete set null,
  generated   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index pit_shifts_start_idx on public.pit_shifts (start_time);

grant select, insert, update, delete on public.pit_shifts to authenticated;

alter table public.pit_shifts enable row level security;

-- Approved members manage the pit schedule together.
create policy "shifts_select" on public.pit_shifts for select using (public.is_approved(auth.uid()));
create policy "shifts_insert" on public.pit_shifts for insert with check (public.is_approved(auth.uid()));
create policy "shifts_update" on public.pit_shifts for update using (public.is_approved(auth.uid()));
create policy "shifts_delete" on public.pit_shifts for delete using (public.is_approved(auth.uid()));
