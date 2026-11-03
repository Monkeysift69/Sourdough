const pool = require('../config/db');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// GET /batches
exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT b.*, s.name AS starter_name, u.username AS baked_by
               FROM batch b
               JOIN starter s ON b.starter_id = s.id
               JOIN user u ON b.user_id = u.id
              ORDER BY b.id DESC`
        );
        res.json(rows);
    } catch (err) {
        fail(res, err);
    }
}

// GET /batches/:id   -> the batch plus the ingredients it used
exports.getOne = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid batch id' });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT b.*, s.name AS starter_name, u.username AS baked_by
               FROM batch b
               JOIN starter s ON b.starter_id = s.id
               JOIN user u ON b.user_id = u.id
              WHERE b.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Batch not found' });

        const [items] = await pool.execute(
            `SELECT sm.id AS movement_id, i.id AS ingredient_id, i.name, i.unit, sm.qty
               FROM stock_movement sm
               JOIN ingredient i ON sm.ingredient_id = i.id
              WHERE sm.batch_id = ?`,
            [id]
        );

        const batch = rows[0];
        batch.items = items;
        res.json(batch);
    } catch (err) {
        fail(res, err);
    }
}

// POST /batches
// body: { starter_id, feeding_time, qty_removed_g, loaf_count,
//         items: [{ ingredient_id, qty }, ...] }
exports.create = async (req, res) => {
    const { starter_id, feeding_time, qty_removed_g, loaf_count, items } = req.body;

    if (!Number.isInteger(starter_id) || starter_id <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (!feeding_time || isNaN(Date.parse(feeding_time))) {
        return res.status(400).json({ error: 'Feeding time must be a date and time' });
    }
    if (!Number.isInteger(qty_removed_g) || qty_removed_g <= 0) {
        return res.status(400).json({ error: 'Starter removed must be a whole number above 0' });
    }
    if (!Number.isInteger(loaf_count) || loaf_count <= 0) {
        return res.status(400).json({ error: 'Loaf count must be a whole number above 0' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Add at least one ingredient' });
    }
    for (const it of items) {
        if (!Number.isInteger(it.ingredient_id) || it.ingredient_id <= 0) {
            return res.status(400).json({ error: 'Each item needs an ingredient id' });
        }
        if (typeof it.qty !== 'number' || it.qty <= 0) {
            return res.status(400).json({ error: 'Each item needs a qty above 0' });
        }
    }

    // The OUT parameter @bid lives on one connection, so CALL and SELECT
    // must use the same connection. The procedure has its own
    // START TRANSACTION / COMMIT / ROLLBACK, so no beginTransaction here.
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'CALL sp_add_batch_with_consumption(?, ?, ?, ?, ?, ?, @bid)',
            [starter_id, feeding_time, qty_removed_g, loaf_count,
             JSON.stringify(items.map(it => ({ ingredient_id: it.ingredient_id, qty: it.qty }))),
             req.session.user.id]
        );
        const [rows] = await conn.query('SELECT @bid AS id');
        const batchId = rows[0].id;
        // the procedure does not set mix_time, so record it now
        await conn.query('UPDATE batch SET mix_time = NOW() WHERE id = ?', [batchId]);
        res.status(201).json({ id: batchId });
    } catch (err) {
        // SIGNAL from trg_stock_no_negative
        if (err.sqlState === '45000') {
            return res.status(409).json({ error: 'Not enough stock for one of the ingredients' });
        }
        // no feeding with that (starter_id, feeding_time), or unknown ingredient
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({ error: 'Feeding or ingredient not found' });
        }
        fail(res, err);
    } finally {
        if (conn) conn.release();
    }
}

// PATCH /batches/:id   body: any of the fields below
exports.update = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid batch id' });
    }

    // only these column names can ever go into the SQL text
    const timeCols = ['mix_time', 'bulk_ferment_start', 'bulk_ferment_end', 'cold_proof_start', 'cold_proof_end'];
    const sets = [];
    const values = [];

    for (const col of timeCols) {
        if (req.body[col] !== undefined) {
            if (req.body[col] !== null && isNaN(Date.parse(req.body[col]))) {
                return res.status(400).json({ error: `${col} must be a date and time` });
            }
            sets.push(`${col} = ?`);
            values.push(req.body[col]);
        }
    }
    if (req.body.loaf_count !== undefined) {
        if (!Number.isInteger(req.body.loaf_count) || req.body.loaf_count <= 0) {
            return res.status(400).json({ error: 'Loaf count must be a whole number above 0' });
        }
        sets.push('loaf_count = ?');
        values.push(req.body.loaf_count);
    }

    if (sets.length === 0) {
        return res.status(400).json({ error: 'Nothing to update' });
    }

    try {
        values.push(id);
        const [r] = await pool.execute(
            `UPDATE batch SET ${sets.join(', ')} WHERE id = ?`,
            values
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Batch not found' });
        res.json({ updated: r.affectedRows });
    } catch (err) {
        fail(res, err);
    }
}

// DELETE /batches/:id
exports.remove = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid batch id' });
    }

    try {
        const [r] = await pool.execute('DELETE FROM batch WHERE id = ?', [id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Batch not found' });
        res.status(204).end();
    } catch (err) {
        // consumption_movement rows still point at this batch
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'This batch has ingredient records and cannot be deleted' });
        }
        fail(res, err);
    }
}
