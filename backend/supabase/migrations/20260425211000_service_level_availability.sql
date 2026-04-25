alter table public.trainer_availability
  add column if not exists service_id uuid references public.services(id) on delete cascade;

alter table public.blocked_dates
  add column if not exists service_id uuid references public.services(id) on delete cascade;

alter table public.bookings
  add column if not exists service_id uuid references public.services(id) on delete set null;

create index if not exists idx_trainer_availability_service_id on public.trainer_availability(service_id);
create index if not exists idx_blocked_dates_service_id on public.blocked_dates(service_id);
create index if not exists idx_bookings_service_id on public.bookings(service_id);
