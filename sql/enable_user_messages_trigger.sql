-- Enable webhook notification from user_messages_web table.
-- Replace placeholders before executing:
--   <VERCEL_APP_URL>             e.g. https://mykahfi-web.vercel.app
--   <SUPABASE_WEBHOOK_SECRET>    must match env SUPABASE_WEBHOOK_SECRET in Vercel
--   <SUPABASE_SERVICE_ROLE_KEY>  should match env SUPABASE_SERVICE_ROLE_KEY in Vercel

drop trigger if exists on_user_messages_web_inserted on public.user_messages_web;
drop trigger if exists on_user_messages_web_updated on public.user_messages_web;

create trigger on_user_messages_web_inserted
after insert on public.user_messages_web
for each row
when (
  new.is_active = true
  and nullif(btrim(new.message_text), '') is not null
)
execute function supabase_functions.http_request(
  '<VERCEL_APP_URL>/api/push/notify-message',
  'POST',
  format(
    '{"Content-Type":"application/json","x-webhook-secret":"%s","Authorization":"Bearer %s"}',
    '<SUPABASE_WEBHOOK_SECRET>',
    '<SUPABASE_SERVICE_ROLE_KEY>'
  ),
  '{}',
  '5000'
);

create trigger on_user_messages_web_updated
after update of message_text, is_active on public.user_messages_web
for each row
when (
  new.is_active = true
  and nullif(btrim(new.message_text), '') is not null
  and (
    new.message_text is distinct from old.message_text
    or new.is_active is distinct from old.is_active
  )
)
execute function supabase_functions.http_request(
  '<VERCEL_APP_URL>/api/push/notify-message',
  'POST',
  format(
    '{"Content-Type":"application/json","x-webhook-secret":"%s","Authorization":"Bearer %s"}',
    '<SUPABASE_WEBHOOK_SECRET>',
    '<SUPABASE_SERVICE_ROLE_KEY>'
  ),
  '{}',
  '5000'
);
