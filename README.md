# Sourdough Log — Express + MySQL

## Setup (once)
1. `npm.cmd install`
2. Copy `.env.example` to `.env` and fill in your MySQL password.
3. In MySQL Workbench, run `sql/schema.sql` (creates the `sourdough` schema, tables, trigger and procedures).
4. `npm.cmd run seed` — fills every table with sample data (or run `sql/seed.sql` in Workbench).

## Run
`npm.cmd start`, then open http://localhost:3000

Demo logins: `dev / dev123` (developer), `admin / admin123` (admin), `baker / baker123` (user).
Run `npm.cmd run seed` again any time to reset the data.

## Layout
```
app.js                 create app, session, static files, mount routes, listen
seed.js                runs sql/seed.sql
config/db.js           createPool (dateStrings: true)
middleware/auth.js     requireLogin, requireRole(...roles)
routes/*.js            URL -> controller function (+ login / role check)
controllers/*.js       validate -> query with ? -> status code
public/index.html      the logbook page (calls the API with fetch)
sql/schema.sql         tables, trigger trg_stock_no_negative, sp_add_batch_with_consumption, sp_record_restock
sql/seed.sql           sample data
```

## Who may do what
| | user | admin | developer |
|---|---|---|---|
| starters, feedings, bakes | ✓ | ✓ | ✓ |
| restock, ingredients | | ✓ | ✓ |
| manage users | | | ✓ |

## Publish on sourdough.maxgunit.org (this PC + the chronos tunnel)
In the Cloudflare dashboard: Networks > Tunnels > chronos > Published application routes > Add
- Subdomain `sourdough`, domain `maxgunit.org`, service type `HTTP`, URL `localhost:3000`

The chronos connector must run on this PC (it is installed as a Windows service, or run
`cloudflared tunnel run --token <token from the dashboard>`).

Before going public:
- `npm.cmd run set-password -- dev <new>` and the same for `admin` and `baker`
- run `sql/app_user.sql` and switch `.env` to the `sourdough_app` user

Every time: double-click `deploy\start-public.bat` (starts the app on port 3000). The PC must stay on.
