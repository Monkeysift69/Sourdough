const router = require('express').Router();
const c = require('../controllers/stock.controller');

router.get('/stock-movements', c.list);
router.post('/stock-movements/restock', c.restock);

module.exports = router;
