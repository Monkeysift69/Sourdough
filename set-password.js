// Change a user's password.
// Usage: npm.cmd run set-password -- <username> <new password>
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.log('Usage: npm.cmd run set-password -- <username> <new password (8+ characters)>');
    process.exitCode = 1;
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.execute('UPDATE user SET password_hash = ? WHERE username = ?', [hash, username]);
    console.log(r.affectedRows === 1 ? `Password changed for ${username}.` : `No user called ${username}.`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
