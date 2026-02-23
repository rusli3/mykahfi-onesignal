-- Enable webhook notification when users.msg_app changes.
-- Replace placeholders before executing:
--   <VERCEL_APP_URL>       e.g. https://mykahfi-web.vercel.app
--   <SUPABASE_WEBHOOK_SECRET> must match env SUPABASE_WEBHOOK_SECRET in Vercel
--   <SUPABASE_SERVICE_ROLE_KEY> can be the same value as env SUPABASE_SERVICE_ROLE_KEY in Vercel

drop trigger if exists on_users_msg_app_changed on public.users;

create trigger on_users_msg_app_changed
after update of msg_app on public.users
for each row
when (new.msg_app is distinct from old.msg_app)
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
