-- Trigger the send-push edge function whenever a notification row is inserted.
-- Requires the pg_net extension (enabled by default on all Supabase projects).
create trigger send_push_on_notification
  after insert on public.notifications
  for each row
  execute function supabase_functions.http_request(
    'https://exmnnotfwebdxjpkvuxu.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY_PLACEHOLDER"}',
    '{}',
    '5000'
  );
