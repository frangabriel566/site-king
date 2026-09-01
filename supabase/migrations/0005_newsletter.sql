-- King Store — 0005_newsletter.sql
-- Small addendum beyond the original schema: the home page's
-- newsletter block needs somewhere to persist signups. Kept as its
-- own migration rather than growing 0001_schema.sql, and documented
-- in DECISIONS.md.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

create policy "newsletter_insert_public"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "newsletter_select_admin"
  on public.newsletter_subscribers for select
  using (public.is_admin());
