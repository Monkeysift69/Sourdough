// Every query here runs on the developer's own MySQL account (req.db).
// Changing a role is a GRANT inside sp_set_role, which only sourdough_developer may EXECUTE.

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  if (err.errno === 1142 || err.errno === 1143 || err.errno === 1370 || err.errno === 1227) {
    return res.status(403).json({ error: 'The database refused: your role cannot do this' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

// the messages sp_set_role / sp_delete_user SIGNAL
function procError(res, err) {
  if (err.sqlState !== '45000') return false;
  const code = err.sqlMessage === 'User not found' ? 404 : 400;
  res.status(code).json({ error: err.sqlMessage });
  return true;
}

// GET /users   role comes from MySQL's grant table (view v_user_roles), not from our user table
exports.list = async (req, res) => {
  try {
    const [rows] = await req.db.execute('SELECT id, username, role, created_at FROM v_user_roles ORDER BY id');
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
  // stop the last developer from locking themselves out (sp_set_role checks this too)
  if (req.session.user.id === id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  try {
    await req.db.execute('CALL sp_set_role(?, ?)', [id, role]);
    res.json({ id: id, role: role });
  } catch (err) {
    if (procError(res, err)) return;
    fail(res, err);
  }
}

// DELETE /users/:id   DROP USER for their MySQL account + delete the row
exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (req.session.user.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    await req.db.execute('CALL sp_delete_user(?)', [id]);
    res.status(204).end();
  } catch (err) {
    if (procError(res, err)) return;
    fail(res, err);
  }
}
