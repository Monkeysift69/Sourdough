const express = require('express');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Behind Cloudflare Tunnel: trust the proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);
app.disable('x-powered-by');            // don't advertise Express in every response

app.use(express.json());                 // lets you read req.body
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',   // HTTPS-only cookie on maxgunit.org
    maxAge: 1000 * 60 * 60 * 8                        // 8 hours
  }
}));
app.use(express.static('public'));       // serves public/index.html

// every route file already has its full path, e.g. router.get('/starters', ...)
app.use(require('./routes/auth.route'));
app.use(require('./routes/starter.route'));
app.use(require('./routes/feeding.route'));
app.use(require('./routes/batch.route'));
app.use(require('./routes/ingredient.route'));
app.use(require('./routes/stocks.routes'));
app.use(require('./routes/user.route'));

// Last stop for any error a route didn't handle (e.g. broken JSON in a request body).
// The real error is logged here on the server; the browser only gets a generic message.
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Bad request' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 3650;
app.listen(PORT, () => {
  console.log(`Sourdough Log running on http://localhost:${PORT}`);
});
