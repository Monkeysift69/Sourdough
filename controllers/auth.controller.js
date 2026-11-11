const { gate, userPools, openUserPool } = require('../config/db');
const { roleFromMysql } = require('../middleware/auth');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// same rule as sp_register_user: becomes the MySQL account 'sd_<username>' (max 32 chars)
const USERNAME = /^[A-Za-z0-9_]{3,29}$/;

// POST /auth/register   body: { username, password }
// The gate account may only CALL sp_register_user, which runs CREATE USER + GRANT sourdough_user.
// MySQL hashes and stores the password itself; our tables never see it.
exports.register = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !USERNAME.test(username)) {
        return res.status(400).json({ error: 'Username: 3-29 letters, digits or _' });
    }
    if (!password || password.length < 8 || password.length > 100) {
        return res.status(400).json({ error: 'Password must be 8-100 characters' });
    }

    try {
        const [sets] = await gate.query('CALL sp_register_user(?, ?)', [username, password]);
        res.status(201).json({ id: sets[0][0].id, username: username, role: 'user' });
    } catch (err) {
        if (err.sqlState === '45000' && err.sqlMessage === 'Username already taken') {
            return res.status(409).json({ error: 'Username already taken' });
        }
        fail(res, err);
    }
}

// POST /auth/login   body: { username, password }
// Logging in = connecting to MySQL as 'sd_<username>'. If MySQL accepts the password, you're in,
// and your role is whatever MySQL says CURRENT_ROLE() is.
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    // same 401 for "no such user" and "wrong password"
    if (!USERNAME.test(username)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const db = openUserPool(username, password);
    try {
        const role = await roleFromMysql(db);   // fails with ER_ACCESS_DENIED_ERROR on a bad password
        if (!role) {
            await db.end();
            return res.status(403).json({ error: 'Your account has no role' });
        }
        const [rows] = await db.execute('SELECT id FROM user WHERE username = ?', [username]);
        if (rows.length === 0) {
            await db.end();
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // one MySQL pool per login session; close an older one from this browser first
        const old = userPools.get(req.sessionID);
        if (old) old.end().catch(() => {});
        userPools.set(req.sessionID, db);

        req.session.user = { id: rows[0].id, username: username, role: role };
        res.json(req.session.user);
    } catch (err) {
        db.end().catch(() => {});
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        fail(res, err);
    }
}

// POST /auth/logout
exports.logout = async (req, res) => {
    const db = userPools.get(req.sessionID);
    if (db) {
        userPools.delete(req.sessionID);
        db.end().catch(() => {});
    }
    req.session.destroy(err => {
        if (err) return fail(res, err);
        res.status(204).end();
    });
}

// GET /auth/me
exports.me = async (req, res) => {
    // not logged in is a normal state, so answer 200 with null instead of an error
    if (!req.session.user || !userPools.has(req.sessionID)) return res.json(null);
    try {
        req.session.user.role = await roleFromMysql(userPools.get(req.sessionID));
        res.json(req.session.user);
    } catch (err) {
        res.json(null);
    }
}
