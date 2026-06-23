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

## 4. Configure redirect URLs

In **Supabase → Authentication → URL Configuration**:

- **Site URL:** your web origin (dev: `http://localhost:8081`).
- **Additional Redirect URLs:** add each environment you sign in from, e.g.
  - `http://localhost:8081` (web dev)
  - `gentoo://` and `gentoo://*` (native standalone / dev build, scheme from `app.json`)
  - your Expo dev URL if testing OAuth in Expo Go

## 5. First sign-in

The **first account to sign in becomes the admin** (auto-approved). Everyone after lands in
*pending* until an admin approves them in the in-app **Admin** screen.
