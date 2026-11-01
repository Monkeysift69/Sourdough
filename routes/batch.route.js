const router = require('express').Router();
const c = require('../controllers/batch.controller');

router.get('/batches', c.getAll);
router.get('/batches/:id', c.getOne);
router.post('/batches', c.create);
router.patch('/batches/:id', c.update);
router.delete('/batches/:id', c.remove);

module.exports = router;
