// Supabase Edge Function: send-push
//
// Invoked by a Database Webhook on INSERT into public.notifications. It looks up
// the recipient's Expo push tokens (with the service role) and forwards the
// notification to Expo's push service. Deploy with:
//   supabase functions deploy send-push
// then create a Database Webhook (Database -> Webhooks) on `notifications`
// INSERT that POSTs to this function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRecord {
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record: NotificationRecord | undefined = payload.record ?? payload.new;
    if (!record?.user_id) {
      return new Response(JSON.stringify({ skipped: 'no record' }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', record.user_id);
    if (error) throw error;

    const messages = (tokens ?? [])
      .map((t: { token: string }) => t.token)
      .filter((to: string) => typeof to === 'string' && to.startsWith('ExponentPushToken'))
      .map((to: string) => ({
        to,
        title: record.title ?? 'Gentoo',
        body: record.body ?? '',
        // Include the type so a tapped push can route (see notification-links).
        data: { ...(record.data ?? {}), type: record.type },
        sound: 'default',
        channelId: 'default',
      }));

    if (messages.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no tokens' }), { status: 200 });
    }

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await expoRes.json();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
