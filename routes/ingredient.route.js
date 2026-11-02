const router = require('express').Router();
const c = require('../controllers/ingredient.controller');
const { requireLogin, requireRole } = require('../middleware/auth');

router.get('/ingredients', requireLogin, c.getAll);
// Must stay above /ingredients/:id, or "stock" is matched as an id
router.get('/ingredients/stock', requireLogin, c.getStock);
router.get('/ingredients/:id', requireLogin, c.getOne);
router.post('/ingredients', requireRole('admin', 'developer'), c.create);
router.put('/ingredients/:id', requireRole('admin', 'developer'), c.update);
router.delete('/ingredients/:id', requireRole('admin', 'developer'), c.remove);

module.exports = router;
