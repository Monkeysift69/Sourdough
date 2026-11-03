const pool = require('../config/db');

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

// GET /stock-movements            -> all movements
// GET /stock-movements?ingredient_id=3  -> one ingredient only
exports.list = async (req, res) => {
  let sql =
    `SELECT sm.id, sm.movement_date, sm.movement_type, sm.qty,
            i.id AS ingredient_id, i.name AS ingredient, i.unit,
            sm.batch_id, rm.cost, cm.reason, u.username AS recorded_by
       FROM stock_movement sm
       JOIN ingredient i ON sm.ingredient_id = i.id
       JOIN user u ON sm.user_id = u.id
       LEFT JOIN restock_movement rm ON rm.id = sm.id
       LEFT JOIN consumption_movement cm ON cm.id = sm.id`;
  const params = [];

  if (req.query.ingredient_id !== undefined) {
    const ingredientId = Number(req.query.ingredient_id);
    if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
      return res.status(400).json({ error: 'Invalid ingredient id' });
    }
    sql += ' WHERE sm.ingredient_id = ?';
    params.push(ingredientId);
  }
  sql += ' ORDER BY sm.movement_date DESC, sm.id DESC';

  try {
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
}

// POST /stock-movements/restock   body: { ingredient_id, qty, cost }   (cost = baht paid for the delivery)
exports.restock = async (req, res) => {
  const { ingredient_id, qty, cost } = req.body;

  if (!Number.isInteger(ingredient_id) || ingredient_id <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }
  if (typeof qty !== 'number' || qty <= 0) {
    return res.status(400).json({ error: 'Qty must be a number above 0' });
  }
  if (typeof cost !== 'number' || cost < 0) {
    return res.status(400).json({ error: 'Cost must be a number, 0 or more' });
  }

  try {
    await pool.execute('CALL sp_record_restock(?, ?, ?, ?)', [ingredient_id, qty, cost, req.session.user.id]);
    res.status(201).json({ ingredient_id, qty, cost });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'Qty must be above 0 and cost 0 or more' });
    }
    fail(res, err);
  }
}

// POST /stock-movements/waste   body: { ingredient_id, qty, reason }
// Stock used up without a bake (spilled, spoiled...). Two inserts that must both
// happen or neither, so they run in one transaction (Lab 9 pattern).
exports.waste = async (req, res) => {
  const { ingredient_id, qty, reason } = req.body;

  if (!Number.isInteger(ingredient_id) || ingredient_id <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }
  if (typeof qty !== 'number' || qty <= 0) {
    return res.status(400).json({ error: 'Qty must be a number above 0' });
  }
  if (!reason || reason.length > 45) {
    return res.status(400).json({ error: 'Reason is required (max 45 characters)' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [r] = await conn.execute(
      "INSERT INTO stock_movement (ingredient_id, movement_date, qty, movement_type, batch_id, user_id) VALUES (?, NOW(), ?, 'consumption', NULL, ?)",
      [ingredient_id, qty, req.session.user.id]
    );   // trg_stock_no_negative checks the stock here
    await conn.execute(
      'INSERT INTO consumption_movement (id, reason) VALUES (?, ?)',
      [r.insertId, reason]
    );
    await conn.commit();
    res.status(201).json({ id: r.insertId, ingredient_id, qty, reason });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.sqlState === '45000') {
      return res.status(409).json({ error: 'Not enough in stock to throw that much away' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    fail(res, err);
  } finally {
    if (conn) conn.release();
  }
}
