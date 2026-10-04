/**
 * =============================================================================
 * PROG2002 Web Development II - Assessment 2
 * event_db.js  -  MySQL connection module for the Charity Events API
 * Student: Shengyang Luo (ID: 24832533)
 * =============================================================================
 *
 * This file is the single place in the backend that knows how to talk to
 * MySQL.  Every route file imports this module instead of creating its own
 * connection, which keeps the credentials in one spot and lets us reuse a
 * connection pool rather than opening a brand new connection per request.
 *
 * It exports:
 *   pool              - the mysql2 connection pool (advanced use)
 *   testConnection()  - verifies the server/database are reachable at startup
 *   query(sql, args)  - runs a parameterised statement and resolves the rows
 *
 * SECURITY NOTE
 *   Credentials are read from environment variables (.env) so that no password
 *   is committed to GitHub.  Copy .env.example to .env and set your own values.
 * =============================================================================
 */

'use strict';

require('dotenv').config();               // loads variables from the .env file

const mysql = require('mysql2/promise');  // promise API -> works with async/await

/** Central configuration object, assembled from environment variables. */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'charityevents_db',

  // DECIMAL columns arrive as JavaScript numbers (60000, not "60000.00") so the
  // API can compare them without parsing.
  decimalNumbers: true,

  // DATE/DATETIME columns are returned exactly as MySQL stores them
  // ('2026-10-15 00:00:00') instead of being converted into JavaScript Date
  // objects. A Date object would be serialised to UTC by JSON.stringify, which
  // shifts every event time backwards by the local timezone offset and makes a
  // 10:00 am event render as 12:00 am. String timestamps avoid that bug and the
  // browser parses them in local time.
  dateStrings: true,

  // Keep the pool small: a student project never needs more than a few
  // simultaneous connections, and MySQL's default max is 151.
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Fail fast (in milliseconds) instead of hanging if MySQL is not running.
  connectTimeout: 10000
};

/**
 * The connection pool shared by the whole application.
 * A pool keeps idle connections open and hands them to each query, which is far
 * cheaper than connecting and authenticating on every single HTTP request.
 */
const pool = mysql.createPool(dbConfig);

/**
 * Checks that the database is reachable.  Called once when the server boots so
 * a configuration mistake is reported immediately rather than on the first
 * request from the browser.
 *
 * @returns {Promise<boolean>} true when the connection succeeded
 */
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    // A trivial query proves the credentials AND the database name are valid.
    const [rows] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
    console.log(`[event_db] Connected to MySQL ${rows[0].version} - database "${rows[0].db}"`);
    return true;
  } catch (error) {
    console.error('[event_db] Could not connect to MySQL:', error.message);
    console.error('[event_db] Check that MySQL is running and that your .env values are correct.');
    return false;
  } finally {
    if (connection) connection.release();   // always give the connection back
  }
}

/**
 * Executes a parameterised SQL statement through the pool.
 *
 * Always pass user input through the `args` array - mysql2 escapes the values,
 * which is what prevents SQL injection (never concatenate strings into SQL).
 *
 * @param {string} sql    SQL statement containing ? placeholders
 * @param {Array}  args   values bound to the placeholders
 * @returns {Promise<Array>} the result rows
 */
async function query(sql, args = []) {
  const [rows] = await pool.query(sql, args);
  return rows;
}

/** Closes every pooled connection - used by tests and graceful shutdown. */
async function closePool() {
  await pool.end();
  console.log('[event_db] Connection pool closed.');
}

module.exports = { pool, query, testConnection, closePool };
