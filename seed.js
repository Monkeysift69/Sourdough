// Runs sql/seed.sql (or the .sql file given) against the database in .env
// Usage: npm.cmd run seed   (run sql/schema.sql once first)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true          // the seed file has many statements
  });
  try {
    const file = process.argv[2] || path.join('sql', 'seed.sql');
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const [results] = await conn.query(sql);
    const counts = results[results.length - 1];
    console.table(counts);
    console.log(`${file} complete.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
