const router = require('express').Router();
const c = require('../controllers/user.controller');
const { requireRole } = require('../middleware/auth');

// developer only
router.get('/users', requireRole('developer'), c.list);
router.patch('/users/:id/role', requireRole('developer'), c.updateRole);
router.delete('/users/:id', requireRole('developer'), c.remove);

module.exports = router;
