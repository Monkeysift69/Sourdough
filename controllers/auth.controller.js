const pool = require('../config/db');
const bcrypt = require('bcryptjs');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// POST /auth/register   body: { username, password }
exports.register = async (req, res) => {
    const { username, password } = req.body;

    if (!username || username.length > 50) {
        return res.status(400).json({ error: 'Username is required (max 50 characters)' });
    }
    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const [r] = await pool.execute(
            'INSERT INTO user (username, password_hash) VALUES (?, ?)',
            [username, hash]
        );
        res.status(201).json({ id: r.insertId, username: username, role: 'user' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already taken' });
        }
        fail(res, err);
    }
}

// POST /auth/login   body: { username, password }
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT id, username, password_hash, role FROM user WHERE username = ?',
            [username]
        );

        // same 401 for "no such user" and "wrong password"
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
        fail(res, err);
    }
}

// POST /auth/logout
exports.logout = async (req, res) => {
    req.session.destroy(err => {
        if (err) return fail(res, err);
        res.status(204).end();
    });
}

// GET /auth/me
exports.me = async (req, res) => {
    // not logged in is a normal state, so answer 200 with null instead of an error
    res.json(req.session.user || null);
}
