// Queries run on the logged-in person's own MySQL account: req.db (set by requireLogin).

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  // MySQL itself said this account has no privilege for it (GRANT missing)
  if (err.errno === 1142 || err.errno === 1143 || err.errno === 1370) {
    return res.status(403).json({ error: 'The database refused: your role cannot do this' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

// GET /ingredients
exports.getAll = async (req, res) => {
  try {
    const [rows] = await req.db.execute('SELECT * FROM ingredient ORDER BY name');
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
}

// GET /ingredients/stock
// stock = everything restocked - everything consumed
exports.getStock = async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT i.id, i.name, i.unit, i.reorder,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'restock' THEN sm.qty ELSE -sm.qty END), 0) AS stock
         FROM ingredient i
         LEFT JOIN stock_movement sm ON sm.ingredient_id = i.id
        GROUP BY i.id, i.name, i.unit, i.reorder
        ORDER BY i.name`
    );
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
}

// GET /ingredients/:id
exports.getOne = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }

  try {
    const [rows] = await req.db.execute('SELECT * FROM ingredient WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ingredient not found' });
    res.json(rows[0]);
  } catch (err) {
    fail(res, err);
  }
}

// POST /ingredients   body: { name, unit, reorder }
exports.create = async (req, res) => {
  const { name, unit, reorder } = req.body;

  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'Name is required (max 80 characters)' });
  }
  if (!unit || unit.length > 5) {
    return res.status(400).json({ error: 'Unit is required (max 5 characters)' });
  }
  if (typeof reorder !== 'number' || reorder < 0) {
    return res.status(400).json({ error: 'Reorder must be a number, 0 or more' });
  }

  try {
    const [r] = await req.db.execute(
      'INSERT INTO ingredient (name, unit, reorder) VALUES (?, ?, ?)',
      [name, unit, reorder]
    );
    res.status(201).json({ id: r.insertId, name, unit, reorder });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An ingredient with that name already exists' });
    }
    fail(res, err);
  }
}

// PUT /ingredients/:id   body: { name, unit, reorder }
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const { name, unit, reorder } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }
  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'Name is required (max 80 characters)' });
  }
  if (!unit || unit.length > 5) {
    return res.status(400).json({ error: 'Unit is required (max 5 characters)' });
  }
  if (typeof reorder !== 'number' || reorder < 0) {
    return res.status(400).json({ error: 'Reorder must be a number, 0 or more' });
  }

  try {
    const [r] = await req.db.execute(
      'UPDATE ingredient SET name = ?, unit = ?, reorder = ? WHERE id = ?',
      [name, unit, reorder, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ updated: r.affectedRows });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An ingredient with that name already exists' });
    }
    fail(res, err);
  }
}

// DELETE /ingredients/:id
exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }

  try {
    const [r] = await req.db.execute('DELETE FROM ingredient WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Ingredient not found' });
    res.status(204).end();
  } catch (err) {
    // stock_movement rows still point at this ingredient
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'This ingredient has stock movements and cannot be deleted' });
    }
    fail(res, err);
  }
}
