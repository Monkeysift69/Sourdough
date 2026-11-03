-- =====================================================================
-- add_user_links.sql — connect `user` to the records it creates
--
-- For a database that already exists. A fresh setup does not need this:
-- sql/schema.sql already contains everything below.
--
-- Run ONCE in MySQL Workbench, logged in as root. A second run stops at the
-- first ALTER, because user_id already exists.
--
--   1. adds user_id to feeding, batch and stock_movement
--   2. gives every existing row to the first developer account
--      (rows made before this change have no known author)
--   3. makes user_id NOT NULL and adds the foreign keys (ON DELETE RESTRICT)
--   4. adds p_user_id to both stored procedures
-- =====================================================================
USE sourdough;

-- 1. add the column as NULL first, so the rows that already exist are allowed
ALTER TABLE feeding        ADD COLUMN user_id INT NULL;
ALTER TABLE batch          ADD COLUMN user_id INT NULL;
ALTER TABLE stock_movement ADD COLUMN user_id INT NULL;

-- 2. old rows -> first developer, or the lowest user id if there is no developer
--    (needs at least one row in `user`, otherwise step 3 stops on the NULLs)
SET @owner = COALESCE(
  (SELECT MIN(id) FROM `user` WHERE role = 'developer'),
  (SELECT MIN(id) FROM `user`)
);
SET SQL_SAFE_UPDATES = 0;     -- Workbench refuses an UPDATE whose WHERE is not a key
UPDATE feeding        SET user_id = @owner WHERE user_id IS NULL;
UPDATE batch          SET user_id = @owner WHERE user_id IS NULL;
UPDATE stock_movement SET user_id = @owner WHERE user_id IS NULL;
SET SQL_SAFE_UPDATES = 1;

-- 3. every record must have a user, and the user must exist
ALTER TABLE feeding
  MODIFY user_id INT NOT NULL,
  ADD KEY fk_feeding_user (user_id),
  ADD CONSTRAINT fk_feeding_user FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE batch
  MODIFY user_id INT NOT NULL,
  ADD KEY fk_batch_user (user_id),
  ADD CONSTRAINT fk_batch_user FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE stock_movement
  MODIFY user_id INT NOT NULL,
  ADD KEY fk_stock_user (user_id),
  ADD CONSTRAINT fk_stock_user FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. the procedures gain a p_user_id parameter (the signature changes, so drop and recreate)
DROP PROCEDURE IF EXISTS sp_record_restock;
DROP PROCEDURE IF EXISTS sp_add_batch_with_consumption;

DELIMITER $$

CREATE PROCEDURE sp_record_restock(
  IN p_ingredient_id INT,
  IN p_qty DECIMAL(8,2),
  IN p_reason VARCHAR(45),
  IN p_user_id INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    INSERT INTO stock_movement (ingredient_id, movement_date, qty, movement_type, user_id)
    VALUES (p_ingredient_id, NOW(), p_qty, 'restock', p_user_id);

    INSERT INTO restock_movement (id, reason)
    VALUES (LAST_INSERT_ID(), p_reason);
  COMMIT;
END$$

CREATE PROCEDURE sp_add_batch_with_consumption(
  IN  p_starter_id    INT,
  IN  p_feeding_time  DATETIME,
  IN  p_qty_removed_g INT,
  IN  p_loaf_count    INT,
  IN  p_items         JSON,   -- [{"ingredient_id":1,"qty":500,"cost":20}, ...]
  IN  p_user_id       INT,    -- who is recording the batch (from the login session)
  OUT p_batch_id      INT
)
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE n INT;
  DECLARE v_ing INT;
  DECLARE v_qty DECIMAL(8,2);
  DECLARE v_cost INT;
  DECLARE v_mid INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET n = JSON_LENGTH(p_items);

  START TRANSACTION;
    INSERT INTO batch (starter_id, feeding_time, qty_removed_g, loaf_count, user_id)
    VALUES (p_starter_id, p_feeding_time, p_qty_removed_g, p_loaf_count, p_user_id);
    SET p_batch_id = LAST_INSERT_ID();

    WHILE i < n DO
      SET v_ing  = JSON_EXTRACT(p_items, CONCAT('$[', i, '].ingredient_id'));
      SET v_qty  = JSON_EXTRACT(p_items, CONCAT('$[', i, '].qty'));
      SET v_cost = JSON_EXTRACT(p_items, CONCAT('$[', i, '].cost'));

      INSERT INTO stock_movement (ingredient_id, movement_date, qty, movement_type, user_id)
      VALUES (v_ing, NOW(), v_qty, 'consumption', p_user_id);   -- trigger checks stock here
      SET v_mid = LAST_INSERT_ID();

      INSERT INTO consumption_movement (id, batch_id, cost)
      VALUES (v_mid, p_batch_id, v_cost);

      SET i = i + 1;
    END WHILE;
  COMMIT;
END$$

DELIMITER ;

-- check: expect 3 rows (feeding, batch, stock_movement), all pointing at `user`
SELECT table_name, column_name, referenced_table_name
  FROM information_schema.key_column_usage
 WHERE table_schema = 'sourdough' AND referenced_table_name = 'user'
 ORDER BY table_name;
