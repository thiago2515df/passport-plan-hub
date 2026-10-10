create table public.destination_images (
  slug text primary key,
  content bytea not null,
  created_at timestamptz not null default now()
);

grant select on public.destination_images to authenticated;
grant all on public.destination_images to service_role;

alter table public.destination_images enable row level security;

create policy "Authenticated can read destination images"
on public.destination_images for select to authenticated using (true);