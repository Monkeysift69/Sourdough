# Sourdough Log — Test Cases (CSS326)

Tick each case during the demo. Requests for every case are in `http/test.http`.

## Setup

- [ ] App running on `http://localhost:3650` (`npm start`)
- [ ] Passwords filled into `@devPass` / `@adminPass` / `@userPass` in the `.http` file
- [ ] REST Client (VS Code) or JetBrains HTTP client installed

---

## Schema & connection

- [ ] **TC01 — ERD & schema** · _role: —_
  - Steps: Open ERD; open a table in schema view.
  - Expected: 5+ entities, 3+ relationships; `feeding.starter_id` is FK → `starter.id` (weak entity, PK = `starter_id` + `feed_time`).
  - Result: ______  Notes: ______

- [ ] **TC02 — App connects via pool; controller join** · _role: —_
  - Steps: Inspect `.env`, `config/db.js`, `controllers/batch.controller.js`; then run `GET /batches`.
  - Expected: app connects through the pool; `GET /batches` returns rows with `starter_name` (join with starter works).
  - Result: ______  Notes: ______

---

## CRUD (entity: `ingredient`)

- [ ] **TC03 — Create** · _role: Admin_
  - Steps: `POST /ingredients` with a new ingredient.
  - Expected: **201**; appears in `GET /ingredients`.
  - Result: ______  New id = ______

- [ ] **TC04 — Read** · _role: User_
  - Steps: `GET /ingredients`, then `GET /ingredients/:id`.
  - Expected: **200** list and detail load with correct data.
  - Result: ______

- [ ] **TC05 — Update** · _role: Admin_
  - Steps: `PUT /ingredients/:id` changing `reorder`.
  - Expected: **200** `{ updated: 1 }`; read-back shows the new value.
  - Result: ______

- [ ] **TC06 — Delete** · _role: Admin_
  - Steps: `DELETE /ingredients/:id` (the TC03 one), then `GET` it.
  - Expected: **204**; follow-up read is **404** (gone from UI and table).
  - Result: ______

- [ ] **TC07 — Validation** · _role: Admin_
  - Steps: `POST /ingredients` with empty `name`.
  - Expected: **400** clear message; no row inserted.
  - Result: ______

---

## Access control

- [ ] **TC08 — User blocked from writes** · _role: User_
  - Steps: as `baker`, try `PUT` / `POST` / `DELETE /ingredients`.
  - Expected: **403** each ("Your role is not allowed to do this").
  - Result: PUT ___  POST ___  DELETE ___

- [ ] **TC09 — Developer-only page** · _role: Developer_
  - Steps: as `dev` `GET /users`; then as `admin` and `baker` `GET /users`.
  - Expected: developer **200**; admin **403**; user **403**.
  - Result: dev ___  admin ___  user ___

---

## Security

- [ ] **TC10 — SQL injection on login** · _role: —_
  - Steps: enter `' OR '1'='1` (and variants) in login.
  - Expected: login **fails (401)**; no error detail shown.
  - Extended probes (any role logged in): `:id` param → **400**; `?ingredient_id=` injection → no leak; blind `SLEEP(5)` → **instant** 400 (not a 5s wait).
  - Result: login ___  `:id` ___  filter ___  blind-timing ___ s

- [ ] **TC11 — Parameterised queries; no creds in code** · _role: —_
  - Steps: grep controllers for `pool.execute`; check `config/db.js` reads `process.env.DB_*`; `.env` is git-ignored.
  - Expected: `?` placeholders only; no credentials in source.
  - Result: ______

- [ ] **TC12 — Error handling** · _role: Admin_
  - Steps: cause a duplicate-key error (`POST /ingredients` with an existing name); also send malformed JSON.
  - Expected: generic message to user (**409** / **400** "Bad request"), **no SQL text / stack trace**; detail only in server log.
  - Result: dup ___  malformed ___

---

## Trigger & stored procedure

- [ ] **TC13 — Trigger** · _role: Admin/User_
  - Steps: `POST /batches` consuming stock (first `GET /starters/1/feedings` for a real `feed_time`).
  - Expected: over-consuming fires `trg_stock_no_negative` → **409** "Not enough stock"; a valid batch is **201** and decrements stock (a `consumption` row appears).
  - Result: over-consume ___  valid ___

- [ ] **TC14 — Stored procedure** · _role: Admin_
  - Steps: `POST /stock-movements/restock`.
  - Expected: **201**; `sp_record_restock` writes a `restock` row (visible via `GET /stock-movements?ingredient_id=1`).
  - Result: ______

## Database-level privilege

- [ ] **TC15 — Privilege lives in MySQL, not in the `user` table** · _role: all_
  - Steps (Workbench, as root):
    1. `SELECT * FROM v_user_roles;` and `SHOW GRANTS FOR 'sd_baker'@'localhost' USING sourdough_user;`
    2. Tamper with our table: `UPDATE user SET username = 'tmp' WHERE id = 1; UPDATE user SET username = 'dev' WHERE id = 3; UPDATE user SET username = 'baker' WHERE id = 1;` (swaps the dev and baker rows)
    3. Log in on the website as `baker / baker123`, try **Record a delivery** and the **Bakers** page.
    4. Put the rows back (same three UPDATEs with `baker` and `dev` swapped).
    5. New Workbench connection as `sd_baker` / `baker123`: `UPDATE user SET username = 'x';`, `GRANT sourdough_developer TO 'sd_baker'@'localhost';`, `DROP TABLE batch;`
  - Expected: step 3 is still a baker (no delivery button, `/users` → **403**). Step 5: every statement is refused by MySQL (**1142** / **1227**).
  - Also run `TC15a`–`TC15g` in `test.http`: register **201**, baker restock **403**, promote **200**, remove **204**.
  - Result: tampered login ___  Workbench as sd_baker ___  API ___

