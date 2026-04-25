ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image'));
