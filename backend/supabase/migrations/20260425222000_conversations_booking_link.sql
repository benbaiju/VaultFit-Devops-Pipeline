alter table public.conversations
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

alter table public.conversations
  add column if not exists service_id uuid references public.services(id) on delete set null;

create unique index if not exists idx_conversations_booking_unique
  on public.conversations(booking_id)
  where booking_id is not null;

create index if not exists idx_conversations_service_id on public.conversations(service_id);
