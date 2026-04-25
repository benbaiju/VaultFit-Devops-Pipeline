alter table public.verification_requests
  add column if not exists identity_url text;

comment on column public.verification_requests.identity_url is
  'Second verification proof: personal identity doc (storage://... or https://...).';
