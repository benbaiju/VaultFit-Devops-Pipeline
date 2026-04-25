alter table public.conversations
  drop constraint if exists conversations_client_id_trainer_id_key;

drop index if exists public.conversations_client_id_trainer_id_key;

create index if not exists idx_conversations_client_trainer
  on public.conversations(client_id, trainer_id);
