-- MySQL dump 10.13  Distrib 26.7.0, for Win64 (x86_64)
--
-- Host: localhost    Database: sourdough
-- ------------------------------------------------------
-- Server version	26.7.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `batch`
--
create schema if not exists sourdough;
use sourdough;

DROP TABLE IF EXISTS `batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batch` (
  `id` int NOT NULL AUTO_INCREMENT,
  `feeding_time` datetime NOT NULL,
  `mix_time` datetime DEFAULT NULL,
  `bulk_ferment_start` datetime DEFAULT NULL,
  `bulk_ferment_end` datetime DEFAULT NULL,
  `cold_proof_start` datetime DEFAULT NULL,
  `cold_proof_end` datetime DEFAULT NULL,
  `qty_removed_g` int NOT NULL,
  `loaf_count` int NOT NULL,
  `starter_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_batch_feeding` (`starter_id`,`feeding_time`),
  CONSTRAINT `fk_batch_feeding` FOREIGN KEY (`starter_id`, `feeding_time`) REFERENCES `feeding` (`starter_id`, `feed_time`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consumption_movement`
--

DROP TABLE IF EXISTS `consumption_movement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consumption_movement` (
  `id` int NOT NULL,
  `movement_type` enum('restock','consumption') NOT NULL DEFAULT 'consumption',
  `reason` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id` (`id`,`movement_type`),
  CONSTRAINT `consumption_movement_ibfk_1` FOREIGN KEY (`id`, `movement_type`) REFERENCES `stock_movement` (`id`, `movement_type`),
  CONSTRAINT `chk_cm_type` CHECK ((`movement_type` = 'consumption'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feeding`
--

DROP TABLE IF EXISTS `feeding`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feeding` (
  `starter_id` int NOT NULL,
  `temp` decimal(4,1) DEFAULT NULL,
  `peaktime` datetime DEFAULT NULL,
  `qty_added_g` int DEFAULT NULL,
  `feed_time` datetime NOT NULL,
  PRIMARY KEY (`starter_id`,`feed_time`),
  KEY `fk1_idx` (`starter_id`),
  CONSTRAINT `fk1` FOREIGN KEY (`starter_id`) REFERENCES `starter` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ingredient`
--

DROP TABLE IF EXISTS `ingredient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ingredient` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `unit` varchar(5) NOT NULL,
  `reorder` decimal(8,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ingredient_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `restock_movement`
--

DROP TABLE IF EXISTS `restock_movement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `restock_movement` (
  `id` int NOT NULL,
  `movement_type` enum('restock','consumption') NOT NULL DEFAULT 'restock',
  `cost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id` (`id`,`movement_type`),
  CONSTRAINT `restock_movement_ibfk_1` FOREIGN KEY (`id`, `movement_type`) REFERENCES `stock_movement` (`id`, `movement_type`),
  CONSTRAINT `chk_rm_type` CHECK ((`movement_type` = 'restock')),
  CONSTRAINT `chk_rm_cost` CHECK ((`cost` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `starter`
--

DROP TABLE IF EXISTS `starter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `starter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `flour_type` varchar(45) NOT NULL,
  `hydration` int NOT NULL,
  `born` date NOT NULL,
  `min_weight_g` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_movement`
--

DROP TABLE IF EXISTS `stock_movement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ingredient_id` int NOT NULL,
  `movement_date` datetime NOT NULL,
  `qty` decimal(8,2) NOT NULL,
  `movement_type` enum('restock','consumption') NOT NULL,
  `batch_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`,`movement_type`),
  KEY `ingredient_id` (`ingredient_id`),
  KEY `fk_stock_batch` (`batch_id`),
  CONSTRAINT `stock_movement_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient` (`id`),
  CONSTRAINT `fk_stock_batch` FOREIGN KEY (`batch_id`) REFERENCES `batch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_movement_chk_1` CHECK ((`qty` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_stock_no_negative` BEFORE INSERT ON `stock_movement` FOR EACH ROW BEGIN
  DECLARE v_stock DECIMAL(10,2);

  IF NEW.movement_type = 'consumption' THEN
    SELECT COALESCE(SUM(CASE WHEN movement_type = 'restock' THEN qty ELSE -qty END), 0)
      INTO v_stock
      FROM stock_movement
     WHERE ingredient_id = NEW.ingredient_id;

    IF NEW.qty > v_stock THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for this ingredient';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('developer','admin','user') NOT NULL DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'sourdough'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_add_batch_with_consumption` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_add_batch_with_consumption`(
  IN  p_starter_id    INT,
  IN  p_feeding_time  DATETIME,
  IN  p_qty_removed_g INT,
  IN  p_loaf_count    INT,
  IN  p_items         JSON,   -- [{"ingredient_id":1,"qty":500}, ...]
  OUT p_batch_id      INT
)
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE n INT;
  DECLARE v_ing INT;
  DECLARE v_qty DECIMAL(8,2);
  DECLARE v_mid INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET n = JSON_LENGTH(p_items);

  START TRANSACTION;
    INSERT INTO batch (starter_id, feeding_time, qty_removed_g, loaf_count)
    VALUES (p_starter_id, p_feeding_time, p_qty_removed_g, p_loaf_count);
    SET p_batch_id = LAST_INSERT_ID();

    WHILE i < n DO
      SET v_ing  = JSON_EXTRACT(p_items, CONCAT('$[', i, '].ingredient_id'));
      SET v_qty  = JSON_EXTRACT(p_items, CONCAT('$[', i, '].qty'));

      INSERT INTO stock_movement (ingredient_id, movement_date, qty, movement_type, batch_id)
      VALUES (v_ing, NOW(), v_qty, 'consumption', p_batch_id);   -- trigger checks stock here
      SET v_mid = LAST_INSERT_ID();

      INSERT INTO consumption_movement (id, reason)
      VALUES (v_mid, 'Used in bake');

      SET i = i + 1;
    END WHILE;
  COMMIT;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_record_restock` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_record_restock`(
  IN p_ingredient_id INT,
  IN p_qty DECIMAL(8,2),
  IN p_cost DECIMAL(10,2)      -- total paid for this delivery
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    INSERT INTO stock_movement (ingredient_id, movement_date, qty, movement_type)
    VALUES (p_ingredient_id, NOW(), p_qty, 'restock');

    INSERT INTO restock_movement (id, cost)
    VALUES (LAST_INSERT_ID(), p_cost);
  COMMIT;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-31 21:53:26

--
-- Views (same definitions as sql/views.sql)
--
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
