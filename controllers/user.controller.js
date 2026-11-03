const pool = require('../config/db');

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

// GET /users   (never send password_hash)
exports.list = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, role, created_at FROM user ORDER BY id');
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
}

// PATCH /users/:id/role   body: { role }
exports.updateRole = async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (!['developer', 'admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be developer, admin or user' });
  }
  // stop the last developer from locking themselves out
  if (req.session.user && req.session.user.id === id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  try {
    const [r] = await pool.execute('UPDATE user SET role = ? WHERE id = ?', [role, id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ updated: r.affectedRows });
  } catch (err) {
    fail(res, err);
  }
}

// DELETE /users/:id
exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (req.session.user && req.session.user.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const [r] = await pool.execute('DELETE FROM user WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (err) {
    // feeding, batch and stock_movement point at user(id) with ON DELETE RESTRICT
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'This user has recorded data and cannot be deleted' });
    }
    fail(res, err);
  }
}
