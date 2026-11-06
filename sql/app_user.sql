-- Least privilege (Lab 10): the website logs in as this user, not root.
-- Run once as root in MySQL Workbench, then put these values in .env:
--   DB_USER=sourdough_app
--   DB_PASS=<the password you choose below>
CREATE USER IF NOT EXISTS 'sourdough_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_to_a_long_password';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON sourdough.* TO 'sourdough_app'@'localhost';
SHOW GRANTS FOR 'sourdough_app'@'localhost';
-- seed.sql uses TRUNCATE, so run it in Workbench with the root login.
