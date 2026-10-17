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
