-- Fix: subtype tables must use the SAME ENUM list as stock_movement.
-- MySQL compares ENUM foreign keys by their position number, not their text:
--   stock_movement:       ENUM('restock','consumption')  -> 'consumption' = 2
--   consumption_movement: ENUM('consumption')            -> 'consumption' = 1   (FK fails)
-- A CHECK keeps each subtype table to its own value.
USE sourdough;

ALTER TABLE consumption_movement DROP FOREIGN KEY consumption_movement_ibfk_1;
ALTER TABLE consumption_movement
  MODIFY movement_type ENUM('restock','consumption') NOT NULL DEFAULT 'consumption',
  ADD CONSTRAINT chk_cm_type CHECK (movement_type = 'consumption');
ALTER TABLE consumption_movement
  ADD CONSTRAINT consumption_movement_ibfk_1 FOREIGN KEY (id, movement_type) REFERENCES stock_movement (id, movement_type);

ALTER TABLE restock_movement DROP FOREIGN KEY restock_movement_ibfk_1;
ALTER TABLE restock_movement
  MODIFY movement_type ENUM('restock','consumption') NOT NULL DEFAULT 'restock',
  ADD CONSTRAINT chk_rm_type CHECK (movement_type = 'restock');
ALTER TABLE restock_movement
  ADD CONSTRAINT restock_movement_ibfk_1 FOREIGN KEY (id, movement_type) REFERENCES stock_movement (id, movement_type);

SELECT 'movement_type fixed' AS result;
