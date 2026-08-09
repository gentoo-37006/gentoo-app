-- Reference photo for an inventory part.
--
-- Stores the object PATH inside the bucket, not a URL: the bucket is private,
-- so the client mints a short-lived signed URL per view. Persisting a signed
-- URL would bake in an expiry and break the row the moment it lapsed.
alter table public.inventory_parts
  add column image_path text;

-- Private bucket. Everything else in this schema is behind RLS, so photos are
-- too — nothing is readable without an approved, logged-in session.
insert into storage.buckets (id, name, public)
values ('inventory-photos', 'inventory-photos', false)
on conflict (id) do nothing;

-- Approved members only, matching the access rule used by the app's tables.
-- Split per verb because storage.objects has no single "manage" action.
create policy "inventory_photos_select_approved"
  on storage.objects for select
  using (bucket_id = 'inventory-photos' and public.is_approved(auth.uid()));

create policy "inventory_photos_insert_approved"
  on storage.objects for insert
  with check (bucket_id = 'inventory-photos' and public.is_approved(auth.uid()));

-- Replacing a photo overwrites the same object, so update is needed too.
create policy "inventory_photos_update_approved"
  on storage.objects for update
  using (bucket_id = 'inventory-photos' and public.is_approved(auth.uid()))
  with check (bucket_id = 'inventory-photos' and public.is_approved(auth.uid()));

create policy "inventory_photos_delete_approved"
  on storage.objects for delete
  using (bucket_id = 'inventory-photos' and public.is_approved(auth.uid()));
