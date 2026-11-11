const { userPools } = require('../config/db');

// Ask MySQL which role this connection really has, e.g. `sourdough_admin`@`%` -> 'admin'.
// This is the only place the app learns a role: nothing in our own tables decides it.
async function roleFromMysql(db) {
  const [rows] = await db.query('SELECT CURRENT_ROLE() AS r');
  const m = /sourdough_(user|admin|developer)/.exec(rows[0].r || '');
  return m ? m[1] : null;
}

// Every route except /auth/* needs a logged-in user.
// req.db = that person's own MySQL connection pool; controllers query through it.
async function requireLogin(req, res, next) {
  const db = userPools.get(req.sessionID);
  if (!req.session.user || !db) {
    return res.status(401).json({ error: 'Please log in' });
  }

  let role;
  try {
    role = await roleFromMysql(db);
  } catch (err) {
    try {
      role = await roleFromMysql(db);   // once more: a developer may have just reset this connection
    } catch (err2) {
      // account removed or password changed in MySQL -> this login is over
      userPools.delete(req.sessionID);
      db.end().catch(() => {});
      return req.session.destroy(() => res.status(401).json({ error: 'Please log in' }));
    }
  }
  if (!role) {
    return res.status(403).json({ error: 'Your account has no role' });
  }

  req.session.user.role = role;   // refreshed from MySQL on every request
  req.db = db;
  next();
}

// Only the listed roles may continue, e.g. requireRole('admin', 'developer').
// This is only the first check, for a clear message: MySQL refuses anyway if the role lacks the GRANT.
function requireRole(...roles) {
  return (req, res, next) => requireLogin(req, res, () => {
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Your role is not allowed to do this' });
    }
    next();
  });
}

module.exports = { requireLogin, requireRole, roleFromMysql };
