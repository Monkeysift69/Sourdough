# Sourdough Log — Express + MySQL

## Setup (once)
1. `npm.cmd install`
2. In MySQL Workbench, logged in as **root**, run in this order:
   1. `sql/schema.sql` — tables, trigger, procedures
   2. `sql/seed.sql` — sample data
   3. `sql/roles.sql` — the MySQL roles, one MySQL account per baker, and the website's `sourdough_gate` login
3. Copy `.env.example` to `.env`: `DB_USER=sourdough_gate`, `DB_PASS` = the `@gate_password` at the top of `roles.sql`, and a `SESSION_SECRET`.

## Run
`npm.cmd start`, then open http://localhost:3650

Demo logins: `dev / dev123` (developer), `admin / admin123` (admin), `baker / baker123` (user).
Run `sql/seed.sql` again any time to reset the data. After re-running `schema.sql`, run `roles.sql` again too
(dropping a procedure also drops its GRANTs).

## Layout
```
app.js                 create app, session, static files, mount routes, listen
config/db.js           gate pool (register only) + one pool per logged-in MySQL account
middleware/auth.js     requireLogin (role = SELECT CURRENT_ROLE()), requireRole(...roles)
routes/*.js            URL -> controller function (+ login / role check)
controllers/*.js       validate -> query with ? -> status code
public/index.html      the logbook page (markup and styles)
public/main.js         the page's code (calls the API with fetch)
sql/schema.sql         tables, trigger trg_stock_no_negative, sp_add_batch_with_consumption, sp_record_restock
sql/seed.sql           sample data
sql/roles.sql          CREATE ROLE + GRANTs, account procedures, gate account, demo accounts
```

## Who may do what
| | user | admin | developer |
|---|---|---|---|
| starters, feedings, bakes | ✓ | ✓ | ✓ |
| restock, ingredients | | ✓ | ✓ |
| manage users | | | ✓ |

## Where the privilege lives: in MySQL, not in our tables
Every baker is a real MySQL account, `'sd_<username>'@'localhost'`, with one of three MySQL roles:
`sourdough_user`, `sourdough_admin` (includes user) or `sourdough_developer` (includes admin).

- **Register**: the website's only shared login, `sourdough_gate`, may do one thing: `CALL sp_register_user`,
  which runs `CREATE USER` (MySQL hashes the password) and `GRANT sourdough_user`.
- **Log in**: the server connects to MySQL *as that person*. Wrong password → MySQL refuses → 401.
  The role is `SELECT CURRENT_ROLE()`, read again on every request.
- **Every query** runs on that person's own connection (`req.db`), so MySQL checks their GRANTs itself.
  `requireRole` in the routes is only a first check for a clear message; with it removed, MySQL still answers 403.
- **Change a role**: `CALL sp_set_role` (only `sourdough_developer` may EXECUTE it) → `REVOKE` + `GRANT`.
- The `user` table now holds only `id, username, created_at`: no password, no role. Editing it changes nobody's rights.
