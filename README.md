# Sourdough Log — Express + MySQL

## Setup (once)
1. `npm.cmd install`
2. Copy `.env.example` to `.env` and fill in your MySQL password and a `SESSION_SECRET` (the app won't start without it).
3. In MySQL Workbench, run `sql/schema.sql` (creates the `sourdough` schema, tables, trigger and procedures).
4. In MySQL Workbench, run `sql/seed.sql` — fills every table with sample data.

## Run
`npm.cmd start`, then open http://localhost:3650

Demo logins: `dev / dev123` (developer), `admin / admin123` (admin), `baker / baker123` (user).
Run `sql/seed.sql` again any time to reset the data.

## Layout
```
app.js                 create app, session, static files, mount routes, listen
config/db.js           createPool (dateStrings: true)
middleware/auth.js     requireLogin, requireRole(...roles)
routes/*.js            URL -> controller function (+ login / role check)
controllers/*.js       validate -> query with ? -> status code
public/index.html      the logbook page (calls the API with fetch)
sql/schema.sql         tables, trigger trg_stock_no_negative, sp_add_batch_with_consumption, sp_record_restock
sql/seed.sql           sample data
sql/app_user.sql       least-privilege MySQL user for the app (Lab 10)
http/sqli-tests.http   SQL injection test requests
scripts/sqli-smoketest.js  SQL injection smoke test
```

## Who may do what
| | user | admin | developer |
|---|---|---|---|
| starters, feedings, bakes | ✓ | ✓ | ✓ |
| restock, ingredients | | ✓ | ✓ |
| manage users | | | ✓ |

## Who did what
Feeding, batch and stock_movement each have a `user_id` that points at `user(id)` (ON DELETE RESTRICT), so every record shows who made it.
The API fills `user_id` from the login session, never from the request body, and returns the name as `logged_by` (feedings), `baked_by` (batches) and `recorded_by` (stock movements).
A user who has recorded data cannot be deleted (409).

## Publish on sourdough.maxgunit.org (this PC + the chronos tunnel)
In the Cloudflare dashboard: Networks > Tunnels > chronos > Published application routes > Add
- Subdomain `sourdough`, domain `maxgunit.org`, service type `HTTP`, URL `localhost:3650`

The chronos connector must run on this PC (it is installed as a Windows service, or run
`cloudflared tunnel run --token <token from the dashboard>`).

Route the URL to `localhost:3650`. Every time: `npm.cmd start` in this folder. The PC must stay on.
