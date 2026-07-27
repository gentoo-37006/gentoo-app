-- Store the penalty score breakdown returned by FTC Scout.
alter table public.matches
  add column if not exists red_penalty int,
  add column if not exists blue_penalty int;
