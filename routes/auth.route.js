const router = require('express').Router();
const c = require('../controllers/auth.controller');

// public — no login needed
router.post('/auth/register', c.register);
router.post('/auth/login', c.login);
router.post('/auth/logout', c.logout);
router.get('/auth/me', c.me);

module.exports = router;
