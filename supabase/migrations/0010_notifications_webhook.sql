-- ============================================================================
-- 0010_notifications_webhook: fire the send-push edge function on new notifications
-- ============================================================================
--
-- When a row is inserted into public.notifications, POST it to the `send-push`
-- edge function, which forwards an OS-level push to the recipient's devices.
--
-- Uses pg_net directly (the project does not have Supabase's Database Webhooks
-- feature / supabase_functions.http_request installed).
--
-- IMPORTANT: replace SERVICE_ROLE_KEY_PLACEHOLDER with the project's service
-- role key before running. The key is required so the request passes the edge
-- function's JWT verification. NEVER commit the real key — keep the placeholder
-- in version control.

create extension if not exists pg_net;

create or replace function public.send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  perform net.http_post(
    url := 'https://exmnnotfwebdxjpkvuxu.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  return NEW;
end;
$func$;

drop trigger if exists send_push_on_notification on public.notifications;
create trigger send_push_on_notification
  after insert on public.notifications
  for each row
  execute function public.send_push_notification();
