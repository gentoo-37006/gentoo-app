-- Who makes the part (goBILDA, REV Robotics, AndyMark, …).
--
-- Free text rather than an enum: FTC teams buy from a long tail of suppliers
-- and print shops, and a fixed list would force "Other" onto anything new. The
-- app suggests values already in use so spelling stays consistent without
-- constraining what can be entered.
alter table public.inventory_parts
  add column manufacturer text;

-- Backfill from names that already lead with the maker, so existing rows show a
-- tag immediately instead of everyone re-typing what the name already says.
update public.inventory_parts
set manufacturer = 'goBILDA'
where manufacturer is null and name ilike 'gobilda%';

update public.inventory_parts
set manufacturer = 'REV Robotics'
where manufacturer is null and (name ilike 'rev %' or part_number ilike 'REV-%');

update public.inventory_parts
set manufacturer = 'AndyMark'
where manufacturer is null and (name ilike 'andymark%' or part_number ilike 'am-%');

-- Supports the "distinct manufacturers already in use" suggestion lookup.
create index inventory_parts_manufacturer_idx
  on public.inventory_parts (manufacturer)
  where manufacturer is not null;
