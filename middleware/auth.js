// Every route except /auth/* needs a logged-in user.
exports.requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please log in' });
  }
  next();
};

// Only the listed roles may continue, e.g. requireRole('admin', 'developer')
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please log in' });
  }
  if (!roles.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Your role is not allowed to do this' });
  }
  next();
};
