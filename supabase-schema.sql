-- ════════════════════════════════════════════════════════════
--  Gypsy Tattoo – Supabase schema + security rules
--  Run once: Supabase dashboard → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════════

-- 1) Site content (markets, events, pricing, portfolio, flash, calendar)
create table if not exists public.site_data (
  key        text primary key,
  value      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_data enable row level security;

drop policy if exists "public can read site data" on public.site_data;
create policy "public can read site data" on public.site_data
  for select to anon, authenticated using (true);

drop policy if exists "owner can write site data" on public.site_data;
create policy "owner can write site data" on public.site_data
  for all to authenticated
  using      ((auth.jwt() ->> 'email') = 'gypsytattoosza@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gypsytattoosza@gmail.com');

-- 2) Booking requests (private: public can only SUBMIT, never read)
create table if not exists public.booking_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name)  between 1 and 100),
  email          text not null check (char_length(email) between 3 and 200),
  phone          text not null check (char_length(phone) between 5 and 30),
  preferred_date date not null,
  slot           text not null check (slot in ('Morning','Afternoon')),
  idea           text not null check (char_length(idea) between 1 and 1500),
  size           text check (char_length(size) <= 100),
  placement      text check (char_length(placement) <= 100),
  status         text not null default 'pending' check (status in ('pending','approved','declined'))
);
alter table public.booking_requests enable row level security;

drop policy if exists "anyone can submit a request" on public.booking_requests;
create policy "anyone can submit a request" on public.booking_requests
  for insert to anon, authenticated
  with check (status = 'pending' and preferred_date >= current_date);

drop policy if exists "owner can manage requests" on public.booking_requests;
create policy "owner can manage requests" on public.booking_requests
  for all to authenticated
  using      ((auth.jwt() ->> 'email') = 'gypsytattoosza@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gypsytattoosza@gmail.com');

-- 3) Spam guard enforced on the server (can't be bypassed from the browser)
create or replace function public.limit_booking_spam() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.booking_requests
        where lower(email) = lower(new.email) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many requests from this email. Please try again tomorrow.';
  end if;
  if (select count(*) from public.booking_requests
        where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many requests right now. Please try again later.';
  end if;
  return new;
end $$;

drop trigger if exists trg_limit_booking_spam on public.booking_requests;
create trigger trg_limit_booking_spam before insert on public.booking_requests
  for each row execute function public.limit_booking_spam();
