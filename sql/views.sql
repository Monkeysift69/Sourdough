-- =====================================================================
-- views.sql — the two views the app reads from
--
-- For a database that already exists: run once in MySQL Workbench (root).
-- It is safe to run again (CREATE OR REPLACE). A fresh setup does not need
-- this file: the same definitions are at the end of schema.sql.
-- =====================================================================
USE sourdough;

-- Stock on hand is derived, never stored: restocked minus consumed.
-- The stock page, the low-stock report and the "can I bake" check all read this.
CREATE OR REPLACE VIEW v_ingredient_stock AS
SELECT i.id, i.name, i.unit, i.reorder,
       COALESCE(SUM(CASE WHEN sm.movement_type = 'restock'     THEN sm.qty END), 0) AS restocked,
       COALESCE(SUM(CASE WHEN sm.movement_type = 'consumption' THEN sm.qty END), 0) AS consumed,
       COALESCE(SUM(CASE WHEN sm.movement_type = 'restock' THEN sm.qty ELSE -sm.qty END), 0) AS stock
  FROM ingredient i
  LEFT JOIN stock_movement sm ON sm.ingredient_id = i.id
 GROUP BY i.id, i.name, i.unit, i.reorder;

-- One row per bake: the batch, its starter's name, and how many ingredient lines it used.
CREATE OR REPLACE VIEW v_batch_summary AS
SELECT b.id, b.starter_id, s.name AS starter_name, b.feeding_time, b.mix_time,
       b.bulk_ferment_start, b.bulk_ferment_end, b.cold_proof_start, b.cold_proof_end,
       b.qty_removed_g, b.loaf_count,
       (SELECT COUNT(*) FROM stock_movement sm WHERE sm.batch_id = b.id) AS ingredient_lines
  FROM batch b
  JOIN starter s ON s.id = b.starter_id;
