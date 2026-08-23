# Supabase setup

The app needs a Supabase project for auth and data. One-time setup:

## 1. Create the project

1. Create a free project at <https://supabase.com>.
2. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
3. In the app repo, copy `.env.example` to `.env` and paste those two values.

## 2. Run the migrations

Apply everything in `supabase/migrations/` in order. Either:

- **SQL editor:** open each file and run it, oldest first; or
- **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

## 3. Enable Google sign-in

1. In the **Google Cloud Console**, create an **OAuth consent screen** and an **OAuth client ID**
   of type *Web application*.
2. Add this **Authorized redirect URI**:
   `https://<YOUR-PROJECT>.supabase.co/auth/v1/callback`
3. In **Supabase → Authentication → Providers → Google**, enable it and paste the Web client ID + secret.

## 3b. Enable Sign in with Apple

Required by App Store guideline 4.8 whenever the Google button ships, so this is not
optional for iOS releases.

1. In the **Apple Developer portal**, enable the *Sign in with Apple* capability on the
   `com.gentoo.app` App ID.
2. In **Supabase → Authentication → Providers → Apple**, enable it and add `com.gentoo.app`
   to **Authorized Client IDs**. Native sign-in uses the identity-token flow
   (`src/lib/apple-auth.ts`), and Supabase checks the token's audience against that list —
   a missing entry fails every sign-in with *Unacceptable audience in id_token*.

## 3c. Apple token revocation (required with account deletion)

Guideline 5.1.1(v) requires the app to **revoke** the user's Apple tokens when they delete
their account, not merely to delete the account. `link-apple` banks a refresh token at
sign-in and `delete-account` revokes it. Without the secrets below both functions log a
warning and skip Apple — deletion still works, but the grant is left standing and the app
does not meet the guideline.

1. In the Apple Developer portal, create a **Sign in with Apple** key and download the `.p8`.
2. Deploy the functions:
   `supabase functions deploy link-apple` and `supabase functions deploy delete-account`.
3. Set the secrets (**Edge Functions → Secrets**, or `supabase secrets set`):

   | Secret | Value |
   | --- | --- |
   | `APPLE_CLIENT_ID` | `com.gentoo.app` |
   | `APPLE_TEAM_ID` | 10-character team id |
   | `APPLE_KEY_ID` | key id of the `.p8` |
   | `APPLE_PRIVATE_KEY` | full contents of the `.p8`, BEGIN/END lines included |

Verify by signing in with Apple, deleting the account in-app, then checking that the app is
gone from **Apple ID → Sign in with Apple** on the device.

## 4. Configure redirect URLs

In **Supabase → Authentication → URL Configuration**:

- **Site URL:** your web origin (dev: `http://localhost:8081`).
- **Additional Redirect URLs:** add each environment you sign in from, e.g.
  - `http://localhost:8081` (web dev)
  - `gentoo://` and `gentoo://*` (native standalone / dev build, scheme from `app.json`)
  - `gentoo://app/` and `gentoo://app/*` (desktop app)
  - your Expo dev URL if testing OAuth in Expo Go

## 5. First sign-in

The **first account to sign in becomes the admin** (auto-approved). Everyone after lands in
*pending* until an admin approves them in the in-app **Admin** screen.

## 6. Push notifications (optional)

In-app realtime notifications work as soon as the DB is set up. For OS-level **push** on
iOS/Android:

1. Deploy the function: `supabase functions deploy send-push`.
2. Create a **Database Webhook** (Database → Webhooks) on `public.notifications`, event **INSERT**,
   that POSTs to the `send-push` function URL.
3. Native push tokens require an **EAS project id** — set `expo.extra.eas.projectId` in `app.json`
   (run `eas init`) and use a dev/standalone build. Web uses in-app realtime only.
