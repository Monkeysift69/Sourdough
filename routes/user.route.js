const router = require('express').Router();
const c = require('../controllers/user.controller');

router.get('/users', c.list);
router.patch('/users/:id/role', c.updateRole);
router.delete('/users/:id', c.remove);

module.exports = router;
