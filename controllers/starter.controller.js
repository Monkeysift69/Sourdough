const pool = require('../config/db');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// GET /starters
exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM starter');
        res.json(rows);
    } catch (err) {
        fail(res, err);
    }
}

// GET /starters/:id
exports.getOne = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM starter WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Starter not found' });
        res.json(rows[0]);
    } catch (err) {
        fail(res, err);
    }
}

// POST /starters   body: { name, flour_type, hydration, born, min_weight_g }
exports.create = async (req, res) => {
    const { name, flour_type, hydration, born, min_weight_g } = req.body;

    if (!name || name.length > 45) {
        return res.status(400).json({ error: 'Name is required (max 45 characters)' });
    }
    if (!flour_type || flour_type.length > 45) {
        return res.status(400).json({ error: 'Flour type is required (max 45 characters)' });
    }
    if (!Number.isInteger(hydration) || hydration <= 0) {
        return res.status(400).json({ error: 'Hydration must be a whole number above 0' });
    }
    if (!born || isNaN(Date.parse(born))) {
        return res.status(400).json({ error: 'Born must be a date (YYYY-MM-DD)' });
    }
    if (!Number.isInteger(min_weight_g) || min_weight_g < 0) {
        return res.status(400).json({ error: 'Min weight must be a whole number, 0 or more' });
    }

    try {
        const [r] = await pool.execute(
            'INSERT INTO starter (name, flour_type, hydration, born, min_weight_g) VALUES (?, ?, ?, ?, ?)',
            [name, flour_type, hydration, born, min_weight_g]
        );
        res.status(201).json({ id: r.insertId, name, flour_type, hydration, born, min_weight_g });
    } catch (err) {
        fail(res, err);
    }
}

// PUT /starters/:id   body: { name, flour_type, hydration, born, min_weight_g }
exports.update = async (req, res) => {
    const id = Number(req.params.id);
    const { name, flour_type, hydration, born, min_weight_g } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (!name || name.length > 45) {
        return res.status(400).json({ error: 'Name is required (max 45 characters)' });
    }
    if (!flour_type || flour_type.length > 45) {
        return res.status(400).json({ error: 'Flour type is required (max 45 characters)' });
    }
    if (!Number.isInteger(hydration) || hydration <= 0) {
        return res.status(400).json({ error: 'Hydration must be a whole number above 0' });
    }
    if (!born || isNaN(Date.parse(born))) {
        return res.status(400).json({ error: 'Born must be a date (YYYY-MM-DD)' });
    }
    if (!Number.isInteger(min_weight_g) || min_weight_g < 0) {
        return res.status(400).json({ error: 'Min weight must be a whole number, 0 or more' });
    }

    try {
        const [r] = await pool.execute(
            'UPDATE starter SET name = ?, flour_type = ?, hydration = ?, born = ?, min_weight_g = ? WHERE id = ?',
            [name, flour_type, hydration, born, min_weight_g, id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Starter not found' });
        res.json({ updated: r.affectedRows });
    } catch (err) {
        fail(res, err);
    }
}

// DELETE /starters/:id
exports.remove = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }

    try {
        const [r] = await pool.execute('DELETE FROM starter WHERE id = ?', [id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Starter not found' });
        res.status(204).end();
    } catch (err) {
        // fk1 is ON DELETE RESTRICT, so a starter with feedings can't be deleted
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'This starter still has feedings' });
        }
        fail(res, err);
    }
}

// GET /starters/:id/feedings
exports.listFeedings = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT f.*, u.username AS logged_by
               FROM feeding f
               JOIN user u ON f.user_id = u.id
              WHERE f.starter_id = ?
              ORDER BY f.feed_time DESC`,
            [id]
        );
        res.json(rows);
    } catch (err) {
        fail(res, err);
    }
}

// POST /starters/:id/feedings   body: { feed_time, temp, peaktime, qty_added_g }
exports.addFeeding = async (req, res) => {
    const id = Number(req.params.id);
    const { feed_time, temp, peaktime, qty_added_g } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (!feed_time || isNaN(Date.parse(feed_time))) {
        return res.status(400).json({ error: 'Feed time must be a date and time' });
    }
    if (temp != null && isNaN(Number(temp))) {
        return res.status(400).json({ error: 'Temp must be a number' });
    }
    if (peaktime != null && isNaN(Date.parse(peaktime))) {
        return res.status(400).json({ error: 'Peak time must be a date and time' });
    }
    if (!Number.isInteger(qty_added_g) || qty_added_g <= 0) {
        return res.status(400).json({ error: 'Food added must be a whole number above 0' });
    }

    try {
        await pool.execute(
            'INSERT INTO feeding (starter_id, feed_time, temp, peaktime, qty_added_g, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [id, feed_time, temp ?? null, peaktime ?? null, qty_added_g, req.session.user.id]   // who did it comes from the login session
        );
        res.status(201).json({ starter_id: id, feed_time, temp, peaktime, qty_added_g });
    } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({ error: 'Starter not found' });
        }
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'This starter already has a feeding at that time' });
        }
        fail(res, err);
    }
}
