alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz null,
  add column if not exists phone_verification_code_hash text null,
  add column if not exists phone_verification_expires_at timestamptz null,
  add column if not exists phone_verification_attempts integer not null default 0;

comment on column public.profiles.phone_verified is
  'True when the current phone value has been OTP verified.';
comment on column public.profiles.phone_verified_at is
  'Timestamp when phone was last OTP verified.';
