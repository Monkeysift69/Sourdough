const router = require('express').Router();
const c = require('../controllers/starter.controller');

router.get('/starters', c.getAll);
router.get('/starters/:id', c.getOne);
router.post('/starters', c.create);
router.put('/starters/:id', c.update);
router.delete('/starters/:id', c.remove);
router.get('/starters/:id/feedings', c.listFeedings);
router.post('/starters/:id/feedings', c.addFeeding);

module.exports = router;
