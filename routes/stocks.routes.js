const router = require('express').Router();
const c = require('../controllers/stock.controller');
const { requireLogin, requireRole } = require('../middleware/auth');

router.get('/stock-movements', requireLogin, c.list);
router.post('/stock-movements/restock', requireRole('admin', 'developer'), c.restock);

module.exports = router;
