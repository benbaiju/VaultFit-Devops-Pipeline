-- Run in Supabase SQL Editor if not using the CLI. Blocks API access when true (enforced in the VaultFit API).
alter table public.profiles
  add column if not exists access_suspended boolean not null default false;

comment on column public.profiles.access_suspended is
  'When true, the API rejects login and all authenticated calls for this user (set by an admin).';
