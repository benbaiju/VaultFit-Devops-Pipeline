-- Optional expertise tags for trainer profiles (JSON array of strings).
alter table public.trainers
  add column if not exists expertise_tags jsonb not null default '[]'::jsonb;
