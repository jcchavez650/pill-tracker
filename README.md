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

It sends "time to take X" reminders for doses due now, marks long-overdue doses as missed, and alerts caregivers. Wire it to Vercel Cron, GitHub Actions, or a free service like cron-job.org. An example GitHub Actions workflow is included at `.github/workflows/reminders.yml`.

## Deploying

The app runs anywhere Next.js runs. For production:

1. Switch `prisma/schema.prisma` datasource to `postgresql` and set `DATABASE_URL` to a managed Postgres.
2. Move uploaded photos from local disk to object storage (S3 / Cloudflare R2) — see `src/lib/upload.ts` (the interface stays the same).
3. Serve over **HTTPS** (required for camera and push).

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
