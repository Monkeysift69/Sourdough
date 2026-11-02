const router = require('express').Router();
const c = require('../controllers/starter.controller');
const { requireLogin } = require('../middleware/auth');

router.get('/starters', requireLogin, c.getAll);
router.get('/starters/:id', requireLogin, c.getOne);
router.post('/starters', requireLogin, c.create);
router.put('/starters/:id', requireLogin, c.update);
router.delete('/starters/:id', requireLogin, c.remove);
router.get('/starters/:id/feedings', requireLogin, c.listFeedings);
router.post('/starters/:id/feedings', requireLogin, c.addFeeding);

module.exports = router;
