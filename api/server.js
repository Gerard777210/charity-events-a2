/**
 * =============================================================================
 * PROG2002 Web Development II - Assessment 2
 * server.js  -  Express application entry point (the RESTful API)
 * Student: Shengyang Luo (ID: 24832533)
 * =============================================================================
 *
 * Responsibilities
 *   1. Configure Express middleware (JSON parsing, CORS, request logging).
 *   2. Mount the event, category, organisation and health route modules.
 *   3. Serve 404 and 500 JSON responses in a consistent shape.
 *   4. Start listening and verify the MySQL connection on boot.
 *
 * Every route module returns data in the same envelope so the client-side code
 * only has to learn one response shape:
 *
 *   success -> { "success": true,  "count": 3, "data": [ ... ] }
 *   failure -> { "success": false, "message": "..." }
 * =============================================================================
 */

'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');

const { testConnection } = require('./event_db');

const eventsRouter = require('./routes/events');
const categoriesRouter = require('./routes/categories');
const organizationsRouter = require('./routes/organizations');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* ---------------------------------------------------------------------------
 * 1. Middleware
 * ------------------------------------------------------------------------ */

// Allow the client-side website (served from a different port) to call this
// API from the browser. Without an Access-Control-Allow-Origin header the
// browser blocks the response before our JavaScript ever sees it.
app.use(cors());

// Parse incoming JSON bodies (Assessment 3 will POST registrations here).
app.use(express.json());

// Tiny request logger - invaluable when demonstrating the API in the video.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`);
  });
  next();
});

// The client-side website is also shipped inside this zip; serving it here
// means the API can be demonstrated from a single `node server.js` process.
app.use(express.static(path.join(__dirname, 'public')));

// Event images (stored as SVG so the project has no binary dependencies) are
// served from the client-side assets folder as well, so the imageUrl values the
// API returns resolve whether the page is opened from the client-side server or
// straight from this one.
app.use('/assets', express.static(path.join(__dirname, '..', 'clientside', 'assets')));

/* ---------------------------------------------------------------------------
 * 2. Routes
 * ------------------------------------------------------------------------ */

/** Health check - lets the marker (and the client site) confirm the API is up. */
app.get('/api/health', async (req, res) => {
  const connected = await testConnection();
  res.status(connected ? 200 : 503).json({
    success: connected,
    message: connected ? 'Charity Events API is running.' : 'Database unavailable.',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/events', eventsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/organizations', organizationsRouter);

/** Friendly API index so the root URL is not a bare 404. */
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Charity Events API',
    unit: 'PROG2002 Web Development II - Assessment 2',
    student: 'Shengyang Luo (24832533)',
    endpoints: [
      'GET /api/health',
      'GET /api/events',
      'GET /api/events/search',
      'GET /api/events/locations',
      'GET /api/events/:id',
      'GET /api/categories',
      'GET /api/organizations'
    ]
  });
});

/* ---------------------------------------------------------------------------
 * 3. Error handling
 * ------------------------------------------------------------------------ */

// 404 - nothing matched the requested URL.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// 500 - central safety net so an unexpected error never crashes the process
// or leaks a stack trace to the browser.
app.use((error, req, res, next) => {   // eslint-disable-line no-unused-vars
  console.error('[server] Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error. Please try again later.'
  });
});

/* ---------------------------------------------------------------------------
 * 4. Start
 * ------------------------------------------------------------------------ */

app.listen(PORT, async () => {
  console.log('='.repeat(70));
  console.log(' Charity Events API - PROG2002 A2');
  console.log(` Listening on http://localhost:${PORT}`);
  console.log(` Client website: http://localhost:${PORT}/index.html`);
  console.log('='.repeat(70));
  await testConnection();
});

module.exports = app;   // exported so automated tests can import it
