// Queries run on the logged-in person's own MySQL account: req.db (set by requireLogin).

function fail(res, err) {
    // MySQL itself said this account has no privilege for it (GRANT missing)
    if (err.errno === 1142 || err.errno === 1143 || err.errno === 1370) {
        return res.status(403).json({ error: 'The database refused: your role cannot do this' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// The key has two parts, so both come from the URL:
// /feedings/:starterId/:feedTime   e.g. /feedings/1/2026-11-01%2010:35:00

// GET /feedings/:starterId/:feedTime
exports.getOne = async (req, res) => {
    const starterId = Number(req.params.starterId);
    const feedTime = req.params.feedTime;

    if (!Number.isInteger(starterId) || starterId <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (isNaN(Date.parse(feedTime))) {
        return res.status(400).json({ error: 'Invalid feed time' });
    }

    try {
        const [rows] = await req.db.execute(
            'SELECT * FROM feeding WHERE starter_id = ? AND feed_time = ?',
            [starterId, feedTime]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Feeding not found' });
        res.json(rows[0]);
    } catch (err) {
        fail(res, err);
    }
}

// PUT /feedings/:starterId/:feedTime   body: { temp, peaktime, qty_added_g }
// The key (starter_id, feed_time) is never changed here.
exports.update = async (req, res) => {
    const starterId = Number(req.params.starterId);
    const feedTime = req.params.feedTime;
    const { temp, peaktime, qty_added_g } = req.body;

    if (!Number.isInteger(starterId) || starterId <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (isNaN(Date.parse(feedTime))) {
        return res.status(400).json({ error: 'Invalid feed time' });
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
        const [r] = await req.db.execute(
            'UPDATE feeding SET temp = ?, peaktime = ?, qty_added_g = ? WHERE starter_id = ? AND feed_time = ?',
            [temp ?? null, peaktime ?? null, qty_added_g, starterId, feedTime]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Feeding not found' });
        res.json({ updated: r.affectedRows });
    } catch (err) {
        fail(res, err);
    }
}

// DELETE /feedings/:starterId/:feedTime
exports.remove = async (req, res) => {
    const starterId = Number(req.params.starterId);
    const feedTime = req.params.feedTime;

    if (!Number.isInteger(starterId) || starterId <= 0) {
        return res.status(400).json({ error: 'Invalid starter id' });
    }
    if (isNaN(Date.parse(feedTime))) {
        return res.status(400).json({ error: 'Invalid feed time' });
    }

    try {
        const [r] = await req.db.execute(
            'DELETE FROM feeding WHERE starter_id = ? AND feed_time = ?',
            [starterId, feedTime]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Feeding not found' });
        res.status(204).end();
    } catch (err) {
        // fk_batch_feeding is ON DELETE RESTRICT
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'A batch was made from this feeding' });
        }
        fail(res, err);
    }
}
