-- =====================================================================
-- roles.sql — every baker is a real MySQL account
-- Run as root in MySQL Workbench, AFTER schema.sql and seed.sql.
-- Run it again every time you re-run schema.sql (dropping a procedure drops its grants).
--
-- Why: before, a baker's privilege was just the text in user.role, so anyone who could run
--   UPDATE user SET role = 'developer' ...   became a developer.
-- Now the privilege is a MySQL GRANT. It lives in MySQL's own system tables, MySQL checks it on
-- every query, and only an account with GRANT rights (root) can change it.
--
--   app role    MySQL role               MySQL account
--   user        sourdough_user           'sd_<username>'@'localhost'
--   admin       sourdough_admin          (one per person, made by sp_register_user)
--   developer   sourdough_developer
--
-- The website itself only knows one shared login: sourdough_gate, which can do nothing except
-- CALL sp_register_user. Everything else runs on the logged-in person's own MySQL account.
--
-- After running: put  DB_USER=sourdough_gate  and  DB_PASS=<@gate_password below>  in .env
-- Demo logins:  dev / dev123   admin / admin123   baker / baker123
-- =====================================================================
USE sourdough;

SET @gate_password = 'change_me_gate_password';   -- the same value goes in .env as DB_PASS

-- ---------------------------------------------------------------------
-- 1. clean start: drop every old app account (sd_...), the roles and the gate account
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_drop_app_accounts;
DELIMITER $$
CREATE PROCEDURE sp_drop_app_accounts()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_user VARCHAR(32);
  DECLARE cur CURSOR FOR SELECT User FROM mysql.user WHERE User LIKE 'sd\_%' AND Host = 'localhost';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  drop_loop: LOOP
    FETCH cur INTO v_user;
    IF done THEN LEAVE drop_loop; END IF;
    SET @s = CONCAT('DROP USER ', QUOTE(v_user), '@''localhost''');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END LOOP;
  CLOSE cur;
END $$
DELIMITER ;
CALL sp_drop_app_accounts();
DROP PROCEDURE sp_drop_app_accounts;

DROP USER IF EXISTS 'sourdough_gate'@'localhost';
DROP ROLE IF EXISTS sourdough_developer, sourdough_admin, sourdough_user;
TRUNCATE TABLE user;

-- ---------------------------------------------------------------------
-- 2. the three roles and what each may do (least privilege)
--    user < admin < developer: each role is granted the one below it
-- ---------------------------------------------------------------------
CREATE ROLE sourdough_user, sourdough_admin, sourdough_developer;

-- user (baker): read the bakery, write starters / feedings / bakes
GRANT SELECT ON sourdough.starter              TO sourdough_user;
GRANT SELECT ON sourdough.feeding              TO sourdough_user;
GRANT SELECT ON sourdough.batch                TO sourdough_user;
GRANT SELECT ON sourdough.ingredient           TO sourdough_user;
GRANT SELECT ON sourdough.stock_movement       TO sourdough_user;
GRANT SELECT ON sourdough.restock_movement     TO sourdough_user;
GRANT SELECT ON sourdough.consumption_movement TO sourdough_user;
GRANT INSERT, UPDATE, DELETE ON sourdough.starter TO sourdough_user;
GRANT INSERT, UPDATE, DELETE ON sourdough.feeding TO sourdough_user;
GRANT INSERT, UPDATE, DELETE ON sourdough.batch   TO sourdough_user;
GRANT SELECT (id, username) ON sourdough.user     TO sourdough_user;   -- to find your own id at login
-- A baker can NOT insert into stock_movement directly. The only way a baker uses up stock is this
-- procedure, which runs with its creator's rights (SQL SECURITY DEFINER) and is checked by the trigger.
GRANT EXECUTE ON PROCEDURE sourdough.sp_add_batch_with_consumption TO sourdough_user;

-- admin: everything a baker can do + ingredients, deliveries, waste
GRANT sourdough_user TO sourdough_admin;
GRANT INSERT, UPDATE, DELETE ON sourdough.ingredient        TO sourdough_admin;
GRANT INSERT ON sourdough.stock_movement                    TO sourdough_admin;   -- waste
GRANT INSERT ON sourdough.consumption_movement              TO sourdough_admin;   -- waste
GRANT EXECUTE ON PROCEDURE sourdough.sp_record_restock      TO sourdough_admin;

-- developer: everything an admin can do + manage bakers (only through the procedures below)
GRANT sourdough_admin TO sourdough_developer;
GRANT SELECT ON sourdough.user TO sourdough_developer;

-- ---------------------------------------------------------------------
-- 3. the view the developer's Bakers page reads: who has which role, straight from MySQL's
--    own grant table (mysql.role_edges), not from anything stored in our tables
-- ---------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY DEFINER VIEW v_user_roles AS
SELECT u.id, u.username, SUBSTRING(r.FROM_USER, 11) AS role, u.created_at
  FROM sourdough.user u
  LEFT JOIN mysql.role_edges r
         ON r.TO_USER = CONCAT('sd_', u.username) AND r.TO_HOST = 'localhost'
        AND r.FROM_USER LIKE 'sourdough\_%';
GRANT SELECT ON sourdough.v_user_roles TO sourdough_developer;

-- ---------------------------------------------------------------------
-- 4. procedures that create / change / remove accounts
--    They run as their creator (root), so the website never needs CREATE USER or GRANT rights.
--    Each one only ever touches 'sd_...' accounts listed in our user table.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_register_user;
DROP PROCEDURE IF EXISTS sp_set_role;
DROP PROCEDURE IF EXISTS sp_delete_user;
DROP PROCEDURE IF EXISTS sp_kick_account;
DELIMITER $$

-- New baker: CREATE USER (MySQL hashes the password) + GRANT sourdough_user + a row in user.
CREATE PROCEDURE sp_register_user(IN p_username VARCHAR(29), IN p_password VARCHAR(100))
BEGIN
  DECLARE v_account VARCHAR(32);

  IF p_username IS NULL OR NOT REGEXP_LIKE(p_username, '^[A-Za-z0-9_]{3,29}$', 'c') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid username';
  END IF;
  IF EXISTS (SELECT 1 FROM sourdough.user WHERE username = p_username)
     OR EXISTS (SELECT 1 FROM mysql.user WHERE User = CONCAT('sd_', p_username)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already taken';
  END IF;

  SET v_account = CONCAT(QUOTE(CONCAT('sd_', p_username)), '@''localhost''');

  SET @s = CONCAT('CREATE USER ', v_account, ' IDENTIFIED BY ', QUOTE(p_password));
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  SET @s = CONCAT('GRANT sourdough_user TO ', v_account);
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  SET @s = CONCAT('SET DEFAULT ROLE ALL TO ', v_account);   -- role is active as soon as they log in
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

  INSERT INTO sourdough.user (username) VALUES (p_username);
  SELECT LAST_INSERT_ID() AS id;
END $$

-- Close every open connection of one account, so a role change or removal takes effect now.
CREATE PROCEDURE sp_kick_account(IN p_account VARCHAR(32))
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_id BIGINT;
  DECLARE cur CURSOR FOR SELECT ID FROM information_schema.PROCESSLIST WHERE USER = p_account;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;   -- connection already gone: fine

  OPEN cur;
  kick_loop: LOOP
    FETCH cur INTO v_id;
    IF done THEN LEAVE kick_loop; END IF;
    SET @s = CONCAT('KILL ', v_id);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END LOOP;
  CLOSE cur;
END $$

-- Developer changes a baker's role: REVOKE the old role, GRANT the new one.
CREATE PROCEDURE sp_set_role(IN p_user_id INT, IN p_role VARCHAR(20))
BEGIN
  DECLARE v_name VARCHAR(29);
  DECLARE v_account VARCHAR(40);

  IF p_role NOT IN ('user', 'admin', 'developer') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role must be developer, admin or user';
  END IF;
  SELECT username INTO v_name FROM sourdough.user WHERE id = p_user_id;
  IF v_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
  END IF;
  -- USER() is whoever called the procedure (CURRENT_USER() would be root)
  IF CONCAT('sd_', v_name) = SUBSTRING_INDEX(USER(), '@', 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot change your own role';
  END IF;

  SET v_account = CONCAT(QUOTE(CONCAT('sd_', v_name)), '@''localhost''');
  SET @s = CONCAT('REVOKE IF EXISTS sourdough_user, sourdough_admin, sourdough_developer FROM ', v_account);
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  SET @s = CONCAT('GRANT sourdough_', p_role, ' TO ', v_account);
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  SET @s = CONCAT('SET DEFAULT ROLE ALL TO ', v_account);
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

  CALL sp_kick_account(CONCAT('sd_', v_name));   -- their next request reconnects with the new role
END $$

-- Developer removes a baker: DROP USER + delete the row.
CREATE PROCEDURE sp_delete_user(IN p_user_id INT)
BEGIN
  DECLARE v_name VARCHAR(29);

  SELECT username INTO v_name FROM sourdough.user WHERE id = p_user_id;
  IF v_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
  END IF;
  IF CONCAT('sd_', v_name) = SUBSTRING_INDEX(USER(), '@', 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot delete your own account';
  END IF;

  CALL sp_kick_account(CONCAT('sd_', v_name));
  SET @s = CONCAT('DROP USER IF EXISTS ', QUOTE(CONCAT('sd_', v_name)), '@''localhost''');
  PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  DELETE FROM sourdough.user WHERE id = p_user_id;
END $$
DELIMITER ;

GRANT EXECUTE ON PROCEDURE sourdough.sp_set_role    TO sourdough_developer;
GRANT EXECUTE ON PROCEDURE sourdough.sp_delete_user TO sourdough_developer;

-- ---------------------------------------------------------------------
-- 5. the website's only shared login: it can register new bakers and nothing else
-- ---------------------------------------------------------------------
SET @s = CONCAT('CREATE USER ''sourdough_gate''@''localhost'' IDENTIFIED BY ', QUOTE(@gate_password));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
GRANT EXECUTE ON PROCEDURE sourdough.sp_register_user TO 'sourdough_gate'@'localhost';

-- ---------------------------------------------------------------------
-- 6. demo accounts
-- ---------------------------------------------------------------------
CALL sp_register_user('dev',   'dev123');     -- id 1
CALL sp_register_user('admin', 'admin123');   -- id 2
CALL sp_register_user('baker', 'baker123');   -- id 3
CALL sp_set_role(1, 'developer');
CALL sp_set_role(2, 'admin');

-- ---------------------------------------------------------------------
-- check
-- ---------------------------------------------------------------------
SELECT * FROM v_user_roles ORDER BY id;
SHOW GRANTS FOR 'sd_baker'@'localhost' USING sourdough_user;
