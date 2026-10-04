# Charity Events REST API (PROG2002 A2)

**Shengyang Luo — 24832533**

This zip contains the **database connection file** (Part 1) and the **RESTful API**
(Part 2) of the assessment. The website that consumes it is in
`usernameA2-clientside.zip`.

The database itself is created from `charityevents_db.sql`, which is submitted
alongside these zips.

## How to run

1. **Import the database.** In MySQL Workbench:
   `Server` → `Data Import` → **Import from Self-Contained File** → choose
   `charityevents_db.sql` → **Start Import**.
   (Or open the file in a query tab and press Execute.)

2. **Install and configure:**

   ```bash
   npm install
   copy .env.example .env        # Windows
   cp  .env.example .env         # macOS / Linux
   ```

   Edit `.env` and set `DB_PASSWORD` to your MySQL password. If your root account
   has no password, leave the value empty (`DB_PASSWORD=`).

3. **Start:**

   ```bash
   npm start
   ```

   Expected output:

   ```
    Charity Events API - PROG2002 A2
    Listening on http://localhost:3000
   [event_db] Connected to MySQL 8.4.9 - database "charityevents_db"
   ```

## Files

| File | Purpose |
|---|---|
| `event_db.js` | **Required by the brief.** MySQL connection pool, `testConnection()` and a parameterised `query()` helper |
| `server.js` | Express app: middleware, CORS, request logging, route mounting, 404/500 handling |
| `routes/events.js` | `GET /api/events`, `/search`, `/locations`, `/:id` |
| `routes/categories.js` | `GET /api/categories` |
| `routes/organizations.js` | `GET /api/organizations` |
| `.env.example` | Template for your local credentials — copy it to `.env` |

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API and database health check |
| GET | `/api/events` | Active events (Home page). Filters: `timeStatus`, `categoryId`, `sort`, `limit` |
| GET | `/api/events/search` | Filter by `dateFilter`, `dateFrom`, `dateTo`, `location`, `categoryId`, `organizationId`, `keyword`, `sort` |
| GET | `/api/events/locations` | Distinct cities for the location dropdown |
| GET | `/api/events/:id` | One active event with full detail |
| GET | `/api/categories` | Categories with active event counts |
| GET | `/api/organizations` | Charities with active event counts |

Every endpoint uses **GET** because each one reads data without modifying it. The
brief states that `POST`, `PUT` and `DELETE` are developed in Assessment 3.

All responses use one envelope:

```json
{ "success": true,  "count": 2, "data": [ ... ] }
{ "success": false, "message": "Event id must be a positive whole number." }
```

## Quick tests

```bash
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/events?timeStatus=upcoming"          # 6 events
curl "http://localhost:3000/api/events/search?categoryId=1,4&location=coffs&dateFilter=upcoming"
curl "http://localhost:3000/api/events/11"                            # 404 - event 11 is suspended
curl "http://localhost:3000/api/events/search?dateFrom=2026-12-31&dateTo=2026-01-01"  # 400 - backwards range
```

`/api/events/11` returning **404** is deliberate: event 11 is marked `suspended`
for breaching policy, and every public query filters on `status = 'active'`, so a
suspended event can never be retrieved.

## Security notes

* All user input is bound as a parameter (`?` placeholders) — never concatenated into SQL.
* The `sort` parameter is validated against a whitelist of column expressions.
* Numeric ids, date formats and string lengths are validated before any query is built.
* Credentials come from `.env`, which is excluded from version control.

## Dependencies

`express`, `mysql2`, `cors`, `dotenv`.
