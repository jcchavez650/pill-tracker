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
- **Prisma** ORM with **SQLite** (swap to Postgres for production)
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
| `DATABASE_URL` | SQLite file path (default is fine locally) |
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

The app is configured to deploy to **[Railway](https://railway.app)** as a single service backed by a persistent **volume**, so the database and uploaded photos survive redeploys. No separate database service is required — it keeps SQLite on the volume.

### One-time setup

1. **Create the project** — on Railway, _New Project → Deploy from GitHub repo_ and pick `pill-tracker`. Railway auto-detects the config in `railway.json` / `nixpacks.toml`.
2. **Add a volume** — in the service, _Settings → Volumes → Add Volume_, mount path `/data`. This is where the DB and photos live permanently.
3. **Set environment variables** (_Variables_ tab):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `file:/data/prod.db` |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `AUTH_SECRET` | a long random string |
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` |
   | `VAPID_SUBJECT` | `mailto:you@example.com` |
   | `CRON_SECRET` | a random string |

4. **Deploy.** On boot, `scripts/start.sh` runs `prisma db push` to create the tables on the volume, then starts Next.js. Railway provides HTTPS automatically (required for camera + push).
5. **Generate a domain** — _Settings → Networking → Generate Domain_ — and open it on your phone, then _Add to Home Screen_.

> **Seeding (optional):** to create demo accounts, run `npm run db:seed` once from the Railway shell (or a local machine pointed at the same `DATABASE_URL`).

### Prefer Railway Postgres instead of SQLite?

Change the datasource in `prisma/schema.prisma` to `postgresql`, add a Railway Postgres plugin, and set `DATABASE_URL` to the provided connection string. You still keep the `/data` volume for photo uploads (`UPLOAD_DIR`).

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
