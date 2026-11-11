-- =====================================================================
-- queries.sql — the report queries (joins, aggregates, nested queries)
-- These are the same statements the /reports/* routes run.
-- =====================================================================
USE sourdough;

-- R1  Low stock                                   [view]
SELECT id, name, unit, stock, reorder
  FROM v_ingredient_stock
 WHERE stock <= reorder
 ORDER BY name;

-- R2  Bakes that made more loaves than the average bake   [nested: scalar subquery in WHERE]
SELECT b.id, s.name AS starter_name, b.feeding_time, b.loaf_count,
       (SELECT ROUND(AVG(loaf_count), 1) FROM batch) AS avg_loaves
  FROM batch b
  JOIN starter s ON s.id = b.starter_id
 WHERE b.loaf_count > (SELECT AVG(loaf_count) FROM batch)
 ORDER BY b.loaf_count DESC, b.id;

-- R3  Ingredients never used in a bake            [nested: correlated NOT EXISTS]
SELECT i.id, i.name, i.unit
  FROM ingredient i
 WHERE NOT EXISTS (SELECT 1
                     FROM stock_movement sm
                    WHERE sm.ingredient_id = i.id
                      AND sm.batch_id IS NOT NULL)
 ORDER BY i.name;

-- R4  Ingredients we spent more on than the average ingredient
--     [JOIN + GROUP BY + HAVING + nested: derived table inside a scalar subquery]
SELECT i.id, i.name, COUNT(*) AS deliveries, SUM(rm.cost) AS total_spent
  FROM restock_movement rm
  JOIN stock_movement sm ON sm.id = rm.id
  JOIN ingredient i      ON i.id = sm.ingredient_id
 GROUP BY i.id, i.name
HAVING SUM(rm.cost) > (SELECT AVG(t.spent)
                         FROM (SELECT SUM(rm2.cost) AS spent
                                 FROM restock_movement rm2
                                 JOIN stock_movement sm2 ON sm2.id = rm2.id
                                GROUP BY sm2.ingredient_id) t)
 ORDER BY total_spent DESC;

-- R5  Output per starter                          [LEFT JOIN + aggregates]
SELECT s.id, s.name, COUNT(b.id) AS bakes,
       COALESCE(SUM(b.loaf_count), 0) AS loaves,
       ROUND(AVG(b.loaf_count), 1)    AS avg_loaves
  FROM starter s
  LEFT JOIN batch b ON b.starter_id = s.id
 GROUP BY s.id, s.name
 ORDER BY loaves DESC, s.name;
