-- Enable webhook notification when new transaction is inserted into bpi_sql_webhook_spb.
-- Replace placeholders before executing:
--   <VERCEL_APP_URL>             e.g. https://mykahfi-web.vercel.app
--   <SUPABASE_WEBHOOK_SECRET>    must match env SUPABASE_WEBHOOK_SECRET in Vercel
--   <SUPABASE_SERVICE_ROLE_KEY>  should match env SUPABASE_SERVICE_ROLE_KEY in Vercel

drop trigger if exists on_payment_received on public.bpi_sql_webhook_spb;

create trigger on_payment_received
after insert on public.bpi_sql_webhook_spb
for each row
execute function supabase_functions.http_request(
  '<VERCEL_APP_URL>/api/push/notify-payment',
  'POST',
  format(
    '{"Content-Type":"application/json","x-webhook-secret":"%s","Authorization":"Bearer %s"}',
    '<SUPABASE_WEBHOOK_SECRET>',
    '<SUPABASE_SERVICE_ROLE_KEY>'
  ),
  '{}',
  '5000'
);
