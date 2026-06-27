#!/bin/bash
# Run this as the Supabase project owner to enable push notifications.
# Usage: bash setup-push-notifications.sh <supabase-access-token> <service-role-key>
#
# Get your access token at: https://supabase.com/dashboard/account/tokens
# Get your service role key at: https://supabase.com/dashboard/project/exmnnotfwebdxjpkvuxu/settings/api

set -e

ACCESS_TOKEN="${1:?Usage: $0 <access-token> <service-role-key>}"
SERVICE_ROLE_KEY="${2:?Usage: $0 <access-token> <service-role-key>}"
PROJECT_REF="exmnnotfwebdxjpkvuxu"

echo "→ Linking project..."
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase link --project-ref "$PROJECT_REF"

echo "→ Deploying send-push edge function..."
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase functions deploy send-push

echo "→ Creating notifications webhook..."
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase db execute --sql "
CREATE OR REPLACE TRIGGER send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://${PROJECT_REF}.supabase.co/functions/v1/send-push',
    'POST',
    '{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer ${SERVICE_ROLE_KEY}\"}',
    '{}',
    '5000'
  );
"

echo "✓ Push notifications are set up."
