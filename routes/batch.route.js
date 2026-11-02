const router = require('express').Router();
const c = require('../controllers/batch.controller');
const { requireLogin } = require('../middleware/auth');

router.get('/batches', requireLogin, c.getAll);
router.get('/batches/:id', requireLogin, c.getOne);
router.post('/batches', requireLogin, c.create);
router.patch('/batches/:id', requireLogin, c.update);
router.delete('/batches/:id', requireLogin, c.remove);

module.exports = router;
