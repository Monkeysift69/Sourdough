const router = require('express').Router();
const c = require('../controllers/feeding.controller');

router.get('/feedings/:starterId/:feedTime', c.getOne);
router.put('/feedings/:starterId/:feedTime', c.update);
router.delete('/feedings/:starterId/:feedTime', c.remove);

module.exports = router;
