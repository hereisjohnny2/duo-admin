# Duo Admin Panel

This is a repo to develop a admin panel for Duo, a Brazilian architecture company. The project is built using Next.js and TypeScript, and it aims to provide a user-friendly interface for managing various aspects of the Duo platform.

## Setup and Run

1. Install Packages

```bash
npm install
```

2. Run the development server and migrations

```bash
npx supabase db reset
npx supabase start
```

3. Start the Next.js development server

```bash
npm run dev
```

## Weekly CSV backup

Every Sunday at 03:00 (Brasília), a [Vercel Cron Job](https://vercel.com/docs/cron-jobs) calls `/api/cron/backup` (schedule in `vercel.json`, `0 6 * * 0` in UTC). The route exports every app table (`acordos`, `parcelas`, `categorias`, `contas`, `inventario_itens`) to CSV and saves the files to the private Supabase Storage bucket `backups`:

```
backups/2026-10-18/contas.csv
backups/2026-10-18/acordos.csv
...
```

The CSVs use the same format as the inventory export (`;` separator, UTF-8 with BOM), so they open directly in Excel. Folders older than 30 days are deleted at the end of each run. Download the files from the Supabase dashboard (*Storage → backups*).

### Setup

1. Apply the migration `supabase/migrations/20261017120000_backups_bucket.sql` (it creates the `backups` bucket).
2. In the Vercel project, add an environment variable `CRON_SECRET` (Production) with a long random value, for example the output of `openssl rand -hex 32`. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` on every cron call; the route refuses any request without it.

To run an export by hand (for example, to test it):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/backup
```

## Password reset emails

"Esqueci a senha" on the login page asks Supabase Auth to email a recovery link. The link points to `/auth/confirm?token_hash=...&type=recovery&next=/reset-password`, which opens a recovery session and sends the user to `/reset-password`. Because it uses `token_hash`, the link works in any browser or device, not only the one that asked for it.

The email template lives in `supabase/templates/recovery.html` (Portuguese, DUO branding). Locally, `supabase start` uses it automatically and every email lands in Mailpit at http://127.0.0.1:54324, so no SMTP is needed.

### Production setup

1. **SMTP (Resend):** in the Supabase dashboard, go to **Authentication → Emails → SMTP Settings** and enable custom SMTP:
   - Sender email: an address on the domain verified in Resend (e.g. `nao-responda@arquitetura-duo.com`)
   - Sender name: `Duo Painel Administrativo`
   - Host `smtp.resend.com`, port `465`, username `resend`, password: a Resend API key
2. **Template:** in **Authentication → Emails → Templates → Reset Password**, set the subject to `Redefinição de senha — Duo Painel Administrativo` and paste the contents of `supabase/templates/recovery.html`.
3. **URLs:** in **Authentication → URL Configuration**, set **Site URL** to the production domain (the email's link and logo are built from it) and add `https://<production-domain>/auth/confirm**` to **Redirect URLs**.
4. **Rate limits:** check the emails-per-hour limit in **Authentication → Rate Limits**.
