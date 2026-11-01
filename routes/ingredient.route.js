const router = require('express').Router();
const c = require('../controllers/ingredient.controller');

router.get('/ingredients', c.getAll);
// Must stay above /ingredients/:id, or "stock" is matched as an id
router.get('/ingredients/stock', c.getStock);
router.get('/ingredients/:id', c.getOne);
router.post('/ingredients', c.create);
router.put('/ingredients/:id', c.update);
router.delete('/ingredients/:id', c.remove);

module.exports = router;
