const pool = require('../config/db');

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

// Same statements as sql/queries.sql. Read-only, so no user input reaches the SQL.
const run = sql => async (req, res) => {
  try {
    const [rows] = await pool.execute(sql);
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
};

// R1  GET /reports/low-stock        view
exports.lowStock = run(
  `SELECT id, name, unit, stock, reorder
     FROM v_ingredient_stock
    WHERE stock <= reorder
    ORDER BY name`);

// R2  GET /reports/big-bakes        nested: scalar subquery in WHERE
exports.bigBakes = run(
  `SELECT b.id, s.name AS starter_name, b.feeding_time, b.loaf_count,
          (SELECT ROUND(AVG(loaf_count), 1) FROM batch) AS avg_loaves
     FROM batch b
     JOIN starter s ON s.id = b.starter_id
    WHERE b.loaf_count > (SELECT AVG(loaf_count) FROM batch)
    ORDER BY b.loaf_count DESC, b.id`);

// R3  GET /reports/unused-ingredients   nested: correlated NOT EXISTS
exports.unusedIngredients = run(
  `SELECT i.id, i.name, i.unit
     FROM ingredient i
    WHERE NOT EXISTS (SELECT 1
                        FROM stock_movement sm
                       WHERE sm.ingredient_id = i.id
                         AND sm.batch_id IS NOT NULL)
    ORDER BY i.name`);

// R4  GET /reports/top-spend        JOIN + GROUP BY + HAVING + nested derived table
exports.topSpend = run(
  `SELECT i.id, i.name, COUNT(*) AS deliveries, SUM(rm.cost) AS total_spent
     FROM restock_movement rm
     JOIN stock_movement sm ON sm.id = rm.id
     JOIN ingredient i      ON i.id = sm.ingredient_id
    GROUP BY i.id, i.name
   HAVING SUM(rm.cost) > (SELECT AVG(t.spent)
                            FROM (SELECT SUM(rm2.cost) AS spent
                                    FROM restock_movement rm2
                                    JOIN stock_movement sm2 ON sm2.id = rm2.id
                                   GROUP BY sm2.ingredient_id) t)
    ORDER BY total_spent DESC`);

// R5  GET /reports/starter-output   LEFT JOIN + aggregates
exports.starterOutput = run(
  `SELECT s.id, s.name, COUNT(b.id) AS bakes,
          COALESCE(SUM(b.loaf_count), 0) AS loaves,
          ROUND(AVG(b.loaf_count), 1)    AS avg_loaves
     FROM starter s
     LEFT JOIN batch b ON b.starter_id = s.id
    GROUP BY s.id, s.name
    ORDER BY loaves DESC, s.name`);
