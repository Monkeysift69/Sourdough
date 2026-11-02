const router = require('express').Router();
const c = require('../controllers/feeding.controller');
const { requireLogin } = require('../middleware/auth');

router.get('/feedings/:starterId/:feedTime', requireLogin, c.getOne);
router.put('/feedings/:starterId/:feedTime', requireLogin, c.update);
router.delete('/feedings/:starterId/:feedTime', requireLogin, c.remove);

module.exports = router;
