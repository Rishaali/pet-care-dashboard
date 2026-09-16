# Pet Care Log & Medication Reminder

A full-stack web application to help pet owners track daily care activities, manage medication schedules, and receive timely reminders — all powered by Node.js, Express, SQLite, and Vanilla JavaScript.

---

## Project Overview

Pet Care Log & Medication Reminder lets you:

- Maintain a complete pet profile (name, breed, age, weight, special instructions)
- Log daily activities (feeding, walking, medication) with one click
- View a **live timeline** of today's activities
- Track **"Last Done"** timers that update automatically
- Schedule medications with daily reminders
- Receive **in-app notification alerts** when a medication is due
- Browse, filter, and export the full care history for the vet

---

## Features

| Feature | Description |
|---|---|
| 🐾 Pet Profile | Store and edit pet info persistently in SQLite |
| ⚡ Quick Actions | One-click logging for Feeding, Walking, Medication |
| ⏱️ Last Done Timers | Auto-updating relative timestamps ("Just now", "2 hours ago") |
| 📅 Daily Timeline | Chronological activity view reset at midnight |
| 💊 Medication Schedules | Full CRUD with date range, reminder time, dosage |
| 🔔 Smart Reminders | Checks every 10s and shows in-app + browser notifications |
| 🕐 Snooze | Snooze any reminder for 5 minutes |
| ✅ Mark as Given | Records medication log + activity, dismisses alert |
| 📋 History | Filter by date/type; exportable text for vets |
| 🗄️ SQLite Storage | All data is persistent — no in-memory dummy arrays |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | Node.js + Express.js |
| Database | SQLite (via `sqlite3` npm package) |
| API Style | REST with `fetch()` on the frontend |
| Fonts & Icons | Google Fonts (Inter, Outfit) + Material Icons |

No React, Angular, Vue, Tailwind CSS, or Bootstrap used.

---

## Project Structure

```
pet-care-log/          ← root (run server.js from here)
│
├── server.js          ← Express app entry point
├── database.js        ← SQLite connection + schema + seeding
├── petcare.db         ← SQLite database file (auto-created)
├── package.json       ← Dependencies and npm start script
│
├── routes/
│   ├── petRoutes.js          ← GET/POST/PUT /api/pets
│   ├── activityRoutes.js     ← GET/POST /api/activities
│   └── medicationRoutes.js   ← /api/medications + /api/medication-logs
│
└── frontend/
    ├── index.html     ← SPA layout: dashboard, profile, medications, history
    ├── style.css      ← Dark glassmorphism design system
    └── script.js      ← All app logic, timers, reminders, API calls
```

---

## Database Schema

### `pets`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | Required |
| age | INTEGER | |
| breed | TEXT | |
| gender | TEXT | |
| weight | REAL | |
| owner_name | TEXT | |
| special_instructions | TEXT | Allergies, vet contacts, etc. |

### `activities`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| pet_id | INTEGER | FK → pets.id |
| activity_type | TEXT NOT NULL | Feeding / Walking / Medication |
| timestamp | DATETIME | ISO 8601 string |
| notes | TEXT | Optional |

### `medications`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| pet_id | INTEGER | FK → pets.id |
| medication_name | TEXT NOT NULL | |
| dosage | TEXT | e.g. "5 ml" |
| frequency | TEXT | e.g. "Twice a day" |
| start_date | DATE | YYYY-MM-DD |
| end_date | DATE | YYYY-MM-DD |
| reminder_time | TEXT | HH:MM (24-hr) |
| notes | TEXT | |

### `medication_logs`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| medication_id | INTEGER | FK → medications.id |
| pet_id | INTEGER | FK → pets.id |
| scheduled_time | DATETIME | When dose was scheduled |
| given_time | DATETIME | When it was actually given |
| status | TEXT | "given" / "snoozed" |

---

## API Endpoints

### Pet APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pets` | Get all pets |
| GET | `/api/pets/:id` | Get pet by ID |
| POST | `/api/pets` | Create new pet |
| PUT | `/api/pets/:id` | Update pet |

### Activity APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/activities` | Log a care activity |
| GET | `/api/activities` | Get all activities (history) |
| GET | `/api/activities/today` | Get today's activities |
| GET | `/api/activities/latest/:type` | Get most recent by type |

### Medication APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/medications` | Get all medication schedules |
| POST | `/api/medications` | Create schedule |
| PUT | `/api/medications/:id` | Update schedule |
| DELETE | `/api/medications/:id` | Delete schedule |

### Medication Log APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/medication-logs` | Get all medication intake records |
| POST | `/api/medication-logs` | Log a dose occurrence |

---

## How to Install

```bash
# Navigate to the project root
cd pet-care-log

# Install dependencies
npm install
```

---

## How to Run

```bash
node server.js
```

Then open your browser and navigate to:

```
http://localhost:3000/
```

The application starts in full, loads the dashboard, and seeds the database with sample data (Bruno, Antibiotic, Vitamin Syrup, and sample activities) if it is brand new.

---

## How Medication Reminders Work

1. When you add a medication schedule, you set a **Reminder Time** (e.g., `09:00 AM`).
2. The frontend `script.js` runs a scheduler check **every 10 seconds**.
3. When the current local clock time matches a medication's reminder time:
   - An **in-app notification banner** slides up from the bottom-right corner.
   - If the browser has granted permission, a **native browser notification** also fires.
4. The banner shows: `"Bruno needs Antibiotic — 5 ml"`
5. Options presented:
   - **Mark as Given**: Records a `medication_logs` entry with `status = "given"` and also adds a `Medication` activity entry to the daily timeline, then dismisses the alert.
   - **Snooze (5m)**: Dismisses the alert and re-triggers it after 5 minutes.
6. Each dose occurrence is tracked by a unique key (`medId_date_time`) so the same reminder never fires twice for the same scheduled slot.
7. Date range is respected — reminders only fire between `start_date` and `end_date`.

---

## Export History Format

Clicking **Export History** generates a plain-text veterinary-friendly report:

```
PET CARE HISTORY

Pet: Bruno
Breed: Labrador
Age: 3 years
Owner: Pet Owner
Date Exported: 25 Aug 2026
--------------------------------------------------

2026-08-25 06:19 AM - Feeding - Ate full bowl of beef kibble
2026-08-25 08:19 AM - Walking - Went around the block, did his business
2026-08-25 10:19 AM - Medication - Antibiotic given successfully
```

The text is automatically copied to your clipboard and shown in a preview alert.

---

## Initial Sample Data

On first startup (empty database), the app automatically seeds:

**Pet:**
- Name: Bruno | Age: 3 | Breed: Labrador | Gender: Male | Weight: 24 kg | Owner: Pet Owner

**Medications:**
- Antibiotic — 5 ml, Twice a day, Reminder at 09:00 AM (Aug 25–30, 2026)
- Vitamin Syrup — 2.5 ml, Once a day, Reminder at 08:00 PM (Aug 20 – Sep 20, 2026)

**Activities (today):**
- Feeding — 5 hours ago
- Walking — 3 hours ago  
- Medication (Antibiotic) — 1 hour ago

Sample data is only inserted once. Re-starting the server will skip seeding if data exists.
