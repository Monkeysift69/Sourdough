const router = require('express').Router();
const c = require('../controllers/report.controller');
const { requireLogin } = require('../middleware/auth');

// Read-only reports: any logged-in user may look.
router.get('/reports/low-stock', requireLogin, c.lowStock);
router.get('/reports/big-bakes', requireLogin, c.bigBakes);
router.get('/reports/unused-ingredients', requireLogin, c.unusedIngredients);
router.get('/reports/top-spend', requireLogin, c.topSpend);
router.get('/reports/starter-output', requireLogin, c.starterOutput);

module.exports = router;
