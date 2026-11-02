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
            rm.reason, cm.batch_id, cm.cost
       FROM stock_movement sm
       JOIN ingredient i ON sm.ingredient_id = i.id
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

// POST /stock-movements/restock   body: { ingredient_id, qty, reason }
exports.restock = async (req, res) => {
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

  try {
    await pool.execute('CALL sp_record_restock(?, ?, ?)', [ingredient_id, qty, reason]);
    res.status(201).json({ ingredient_id, qty, reason });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'Qty must be above 0' });
    }
    fail(res, err);
  }
}
