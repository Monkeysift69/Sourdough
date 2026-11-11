-- =====================================================================
-- seed.sql — sample data for the Sourdough Log
-- Run AFTER schema.sql, in MySQL Workbench.
-- Running it again wipes the tables and starts over.
-- Times are relative to NOW(), so READY / HUNGRY / RISING are live every time you seed.
--
-- Logins are MySQL accounts made by roles.sql (run it after this file the first time).
-- =====================================================================
USE sourdough;

-- empty every table (children first) and restart the AUTO_INCREMENT counters
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE consumption_movement;
TRUNCATE TABLE restock_movement;
TRUNCATE TABLE stock_movement;
TRUNCATE TABLE batch;
TRUNCATE TABLE feeding;
TRUNCATE TABLE starter;
TRUNCATE TABLE ingredient;
SET FOREIGN_KEY_CHECKS = 1;

-- one fixed "now" (to the minute) so every row below lines up exactly
SET @now = STR_TO_DATE(DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:00'), '%Y-%m-%d %H:%i:%s');

-- ---------------------------------------------------------------------
-- starter
-- ---------------------------------------------------------------------
INSERT INTO starter (id, name, flour_type, hydration, born, min_weight_g) VALUES
  (1, 'San Francisco Mother Levain', 'Unbleached Bread Flour',  100, DATE(@now - INTERVAL 306 DAY), 200),
  (2, 'Nordic Rye Starter',          'Dark Rye Flour',          100, DATE(@now - INTERVAL 252 DAY), 150),
  (3, 'Heritage Whole Wheat',        'Stoneground Whole Wheat', 100, DATE(@now - INTERVAL 179 DAY), 150);

-- ---------------------------------------------------------------------
-- feeding  (weak entity, key = starter_id + feed_time)
--   starter 1: peaked 30 min ago  -> READY
--   starter 2: peaked 8 h ago     -> HUNGRY
--   starter 3: peaks in 4 h       -> RISING
-- ---------------------------------------------------------------------
INSERT INTO feeding (starter_id, feed_time, temp, peaktime, qty_added_g) VALUES
  (1, @now - INTERVAL 30 HOUR,  26.5, @now - INTERVAL 24 HOUR,  300),
  (2, @now - INTERVAL 28 HOUR,  25.0, @now - INTERVAL 22 HOUR,  200),
  (2, @now - INTERVAL 14 HOUR,  25.0, @now - INTERVAL 8 HOUR,   250),
  (1, @now - INTERVAL 6 HOUR,   27.0, @now - INTERVAL 30 MINUTE, 350),
  (3, @now - INTERVAL 2 HOUR,   24.5, @now + INTERVAL 4 HOUR,   200);

-- ---------------------------------------------------------------------
-- ingredient
-- ---------------------------------------------------------------------
INSERT INTO ingredient (id, name, unit, reorder) VALUES
  (1, 'High-Protein Bread Flour', 'g',  5000),
  (2, 'Organic Dark Rye Flour',   'g',  2000),
  (3, 'Whole Wheat Flour',        'g',  2000),
  (4, 'Fine Brittany Sea Salt',   'g',  500),
  (5, 'Filtered Spring Water',    'ml', 5000),
  (6, 'Toasted Sesame Seeds',     'g',  800);

-- ---------------------------------------------------------------------
-- stock_movement + restock_movement  (deliveries, 3 days ago; cost = baht paid)
-- ---------------------------------------------------------------------
INSERT INTO stock_movement (id, ingredient_id, movement_date, qty, movement_type) VALUES
  (1, 1, @now - INTERVAL 72 HOUR, 25000, 'restock'),
  (2, 2, @now - INTERVAL 72 HOUR, 8000,  'restock'),
  (3, 3, @now - INTERVAL 72 HOUR, 10000, 'restock'),
  (4, 4, @now - INTERVAL 72 HOUR, 3000,  'restock'),
  (5, 5, @now - INTERVAL 72 HOUR, 30000, 'restock'),
  (6, 6, @now - INTERVAL 72 HOUR, 250,   'restock');

INSERT INTO restock_movement (id, cost) VALUES
  (1, 875.00),    -- 25 kg bread flour
  (2, 480.00),    -- 8 kg rye flour
  (3, 450.00),    -- 10 kg whole wheat flour
  (4, 450.00),    -- 3 kg sea salt
  (5, 30.00),     -- 30 L filtered water
  (6, 62.50);     -- 250 g sesame seeds

-- ---------------------------------------------------------------------
-- batch
--   101: baked yesterday (all four stages done), made from starter 1's older feeding
--   102: in bulk ferment now, made from starter 2's latest feeding
-- feeding_time must match a feeding row exactly (fk_batch_feeding)
-- ---------------------------------------------------------------------
INSERT INTO batch (id, starter_id, feeding_time, qty_removed_g, loaf_count,
                   mix_time, bulk_ferment_start, bulk_ferment_end, cold_proof_start, cold_proof_end) VALUES
  (101, 1, @now - INTERVAL 30 HOUR, 240, 12,
        @now - INTERVAL 23 HOUR, @now - INTERVAL 1350 MINUTE, @now - INTERVAL 1050 MINUTE,
        @now - INTERVAL 1050 MINUTE, @now - INTERVAL 5 HOUR),
  (102, 2, @now - INTERVAL 14 HOUR, 180, 8,
        @now - INTERVAL 7 HOUR, @now - INTERVAL 390 MINUTE, NULL, NULL, NULL);

-- ---------------------------------------------------------------------
-- stock_movement + consumption_movement  (what each batch used, plus one waste)
-- batch_id links a movement to the bake that used it (NULL = not from a bake)
-- trg_stock_no_negative checks each row against the restocks above
-- ---------------------------------------------------------------------
INSERT INTO stock_movement (id, ingredient_id, movement_date, qty, movement_type, batch_id) VALUES
  (7,  1, @now - INTERVAL 23 HOUR, 5400, 'consumption', 101),
  (8,  3, @now - INTERVAL 23 HOUR, 600,  'consumption', 101),
  (9,  5, @now - INTERVAL 23 HOUR, 4500, 'consumption', 101),
  (10, 4, @now - INTERVAL 23 HOUR, 120,  'consumption', 101),
  (11, 2, @now - INTERVAL 7 HOUR,  2800, 'consumption', 102),
  (12, 1, @now - INTERVAL 7 HOUR,  1200, 'consumption', 102),
  (13, 5, @now - INTERVAL 7 HOUR,  3200, 'consumption', 102),
  (14, 4, @now - INTERVAL 7 HOUR,  80,   'consumption', 102),
  (15, 3, @now - INTERVAL 20 HOUR, 400,  'consumption', NULL);

INSERT INTO consumption_movement (id, reason) VALUES
  (7, 'Used in bake'), (8, 'Used in bake'), (9, 'Used in bake'), (10, 'Used in bake'),
  (11, 'Used in bake'), (12, 'Used in bake'), (13, 'Used in bake'), (14, 'Used in bake'),
  (15, 'Bag torn, flour spilled');

-- ---------------------------------------------------------------------
-- check
-- ---------------------------------------------------------------------
SELECT 'starter' AS t, COUNT(*) AS n FROM starter
UNION ALL SELECT 'feeding', COUNT(*) FROM feeding
UNION ALL SELECT 'batch', COUNT(*) FROM batch
UNION ALL SELECT 'ingredient', COUNT(*) FROM ingredient
UNION ALL SELECT 'stock_movement', COUNT(*) FROM stock_movement
UNION ALL SELECT 'user', COUNT(*) FROM user;   -- the accounts come from roles.sql
