# 💊 Pill Tracker

A luxurious, bilingual (English / Spanish) **medication management** app for caregivers and the people they care for. Built as an installable Progressive Web App (PWA) so it works on any phone, tablet, or desktop.

> _"Care, made simple and beautiful."_

## What it does

- **📅 Pill schedules** — Add each medication with strength, form, instructions, times of day, and a reference photo of what the pill looks like.
- **📷 Photo confirmation** — Before taking a dose, the patient snaps a photo of the pills. **Claude AI** checks them against what's expected and returns a match / mismatch / unsure verdict with a confidence score.
- **🔍 Identify a pill** — Not sure about a pill? Take a photo, optionally ask a question, and Claude identifies it (color, shape, imprint, likely medication) with a safety reminder.
- **👥 Users & roles** — **Caregivers** create schedules, manage patients, and view reports. **Patients** log in to take and confirm their pills. A caregiver can manage multiple patients.
- **🔔 Alerts** — Web-push reminders when a dose is due, plus alerts to the caregiver on missed doses or a possible photo mismatch. In-app notification bell too.
- **📊 Reporting** — Adherence rate, taken/missed/skipped counts, and a full permanent history with the confirmation photos.
- **🌐 Language toggle** — Switch between English and Spanish anywhere, instantly. Saved per user.
- **♾️ Saved indefinitely** — All data (schedules, photos, history) is stored in a database that persists as long as you keep it.

## Tech stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Prisma** ORM with **PostgreSQL** (photos stored as bytes in the DB — no volume needed)
- **Tailwind CSS** — custom "champagne on charcoal" luxe theme
- **@anthropic-ai/sdk** — Claude vision for pill ID & confirmation
- **web-push** (VAPID) — browser/PWA push notifications
- Lightweight JWT session auth (bcrypt + jose)

## Getting started

### 1. Install & configure

```bash
npm install
cp .env.example .env
```

Then edit `.env`:

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/pilltracker`) |
| `AUTH_SECRET` | Random string for signing sessions — generate one (see below) |
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com/settings/keys) — powers pill ID & confirmation |
| `ANTHROPIC_MODEL` | Claude vision model (default `claude-sonnet-5`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web-push keys — `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | Protects the reminder cron endpoint |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # AUTH_SECRET
npx web-push generate-vapid-keys                                            # VAPID keys
```

> The app runs **without** the Anthropic key — AI features simply show a "not configured" message until you add it. Add `ANTHROPIC_API_KEY` to switch them on.

### 2. Create the database

Point `DATABASE_URL` at any PostgreSQL instance (local Postgres, Docker, or a hosted one), then:

```bash
npm run db:push     # creates tables
npm run db:seed     # optional demo accounts + medications
```

Seed logins: `caregiver@example.com` / `password123` and `mom@example.com` / `password123`.

### 3. Run

```bash
npm run dev         # http://localhost:3000
```

Open on your phone, then **Add to Home Screen** to install it as an app.

## Reminders (cron)

Push reminders are sent by an endpoint that a scheduler calls every few minutes:

```
GET /api/cron/reminders   Authorization: Bearer <CRON_SECRET>
```

It sends "time to take X" reminders for doses due now, marks long-overdue doses as missed, and alerts caregivers. Wire it to GitHub Actions (workflow included at `.github/workflows/reminders.yml`), Railway's cron, or a free service like cron-job.org.

## Deploying to Railway

The app deploys to **[Railway](https://railway.app)** with a managed **PostgreSQL** database — **no volume required**. All data, including pill photos (stored as bytes in the database), lives in Postgres and survives every redeploy.

### One-time setup

1. **Create the project** — on Railway, _New Project → Deploy from GitHub repo_ and pick `pill-tracker`. Railway auto-detects the config in `railway.json` / `nixpacks.toml`.
2. **Add PostgreSQL** — in the project, _New → Database → Add PostgreSQL_. Railway creates it with a `DATABASE_URL` variable you can reference.
3. **Set environment variables** on the app service (_Variables_ tab):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (references the Postgres service) |
   | `AUTH_SECRET` | a long random string |
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` |
   | `VAPID_SUBJECT` | `mailto:you@example.com` |
   | `CRON_SECRET` | a random string |

4. **Deploy.** On boot, `scripts/start.sh` runs `prisma db push` to create the tables in Postgres, then starts Next.js. Railway provides HTTPS automatically (required for camera + push).
5. **Generate a domain** — _Settings → Networking → Generate Domain_ — and open it on your phone, then _Add to Home Screen_.

> **Seeding (optional):** to create demo accounts, run `npm run db:seed` once from the Railway shell (or a local machine pointed at the same `DATABASE_URL`).

### Photo storage

Uploaded photos are stored as bytes in the `Photo` table and served via `GET /api/uploads/<id>`. This keeps everything in one database with no volume or external object storage. If you later expect very high photo volume, you can move `src/lib/upload.ts` to S3/Cloudflare R2 — the `/api/uploads` serving path and callers stay the same.

### Reminders on Railway

Add a second service (or a Railway cron) that calls `POST /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>` every few minutes, or just keep the included GitHub Actions workflow (set its `APP_URL` and `CRON_SECRET` repo secrets to your Railway URL).

## Project layout

```
src/
  app/
    (app)/            authenticated pages: today, schedule, identify, reports, patients, settings
    api/              route handlers (auth, medications, doses, identify, reports, patients, push, cron)
    signin, signup    auth pages
  components/         UI: AppShell, PhotoCapture, Modal, LanguageToggle, NotificationsBell, contexts
  lib/                prisma, auth, anthropic, push, i18n, dose scheduling, uploads, access control
prisma/               schema + seed
public/               PWA manifest, service worker, icon
```

## Safety note

AI pill identification and confirmation are **guidance only** and can be wrong. Always confirm medications with a pharmacist or doctor. This app is not a medical device.
