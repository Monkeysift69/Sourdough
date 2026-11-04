# CSS326 Lab — Test Case Checklist (Sourdough Log)

## Schema & connection

- [x] **TC01 — ERD & schema** · _role: —_
  - Steps: Open ERD; open a table in schema view.
  - Expected: 5+ entities, 3+ relationships; `feeding.starter_id` is FK → `starter.id` (weak entity, PK = `starter_id` + `feed_time`).


- [x] **TC02 — App connects via pool; controller join** · _role: —_
  - Steps: Inspect `.env`, `config/db.js`, `controllers/batch.controller.js`; then run `GET /batches`.
  - Expected: app connects through the pool; `GET /batches` returns rows with `starter_name` and `baked_by` (join works).


---

## CRUD (entity: `ingredient`)

- [x] **TC03 — Create** · _role: Admin_
  - Steps: `POST /ingredients` with a new ingredient.
  - Expected: **201**; appears in `GET /ingredients`.


- [x] **TC04 — Read** · _role: User_
  - Steps: `GET /ingredients`, then `GET /ingredients/:id`.
  - Expected: **200** list and detail load with correct data.


- [x] **TC05 — Update** · _role: Admin_
  - Steps: `PUT /ingredients/:id` changing `reorder`.
  - Expected: **200** `{ updated: 1 }`; read-back shows the new value.


- [x] **TC06 — Delete** · _role: Admin_
  - Steps: `DELETE /ingredients/:id` (the TC03 one), then `GET` it.
  - Expected: **204**; follow-up read is **404** (gone from UI and table).


- [x] **TC07 — Validation** · _role: Admin_
  - Steps: `POST /ingredients` with empty `name`.
  - Expected: **400** clear message; no row inserted.


---

## Access control

- [x] **TC08 — User blocked from writes** · _role: User_
  - Steps: as `baker`, try `PUT` / `POST` / `DELETE /ingredients`.
  - Expected: **403** each ("Your role is not allowed to do this").


- [x] **TC09 — Developer-only page** · _role: Developer_
  - Steps: as `dev` `GET /users`; then as `admin` and `baker` `GET /users`.
  - Expected: developer **200**; admin **403**; user **403**.


---

## Security

- [x] **TC10 — SQL injection on login** · _role: —_
  - Steps: enter `' OR '1'='1` (and variants) in login.
  - Expected: login **fails (401)**; no error detail shown.
  - Extended probes (any role logged in): `:id` param → **400**; `?ingredient_id=` injection → no leak; blind `SLEEP(5)` → **instant** 400 (not a 5s wait).


- [x] **TC11 — Parameterised queries; no creds in code** · _role: —_
  - Steps: grep controllers for `pool.execute`; check `config/db.js` reads `process.env.DB_*`; `.env` is git-ignored.
  - Expected: `?` placeholders only; no credentials in source.


- [x] **TC12 — Error handling** · _role: Admin_
  - Steps: cause a duplicate-key error (`POST /ingredients` with an existing name); also send malformed JSON.
  - Expected: generic message to user (**409** / **400** "Bad request"), **no SQL text / stack trace**; detail only in server log.


---

## Trigger & stored procedure

- [x] **TC13 — Trigger** · _role: Admin/User_
  - Steps: `POST /batches` consuming stock (first `GET /starters/1/feedings` for a real `feed_time`).
  - Expected: over-consuming fires `trg_stock_no_negative` → **409** "Not enough stock"; a valid batch is **201** and decrements stock (a `consumption` row appears).
 

- [x] **TC14 — Stored procedure** · _role: Admin_
  - Steps: `POST /stock-movements/restock`.
  - Expected: **201**; `sp_record_restock` writes a `restock` row (visible via `GET /stock-movements?ingredient_id=1`).

---

