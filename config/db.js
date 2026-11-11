const mysql = require('mysql2/promise');
require('dotenv').config();

// The website's only shared login (DB_USER in .env = sourdough_gate).
// MySQL lets it do one thing: CALL sp_register_user. See sql/roles.sql.
const gate = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 2,
  dateStrings: true   // DATETIME comes back as 'YYYY-MM-DD HH:MM:SS', no timezone shift
});

// Everything else runs on the logged-in person's OWN MySQL account ('sd_<username>'),
// so MySQL itself checks their privileges on every query.
// One small pool per login, kept in server memory only (the password is never stored anywhere).
const userPools = new Map();   // session id -> pool

function openUserPool(username, password) {
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: 'sd_' + username,
    password: password,
    database: process.env.DB_NAME,
    connectionLimit: 3,
    dateStrings: true
  });
}

module.exports = { gate, userPools, openUserPool };
