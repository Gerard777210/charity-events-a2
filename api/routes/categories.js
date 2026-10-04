/**
 * =============================================================================
 * PROG2002 Web Development II - Assessment 2
 * routes/categories.js  -  RESTful endpoint for the "categories" resource
 * Student: Shengyang Luo (ID: 24832533)
 * =============================================================================
 *
 * GET /api/categories
 *   Supplies the checkbox list on the Search page and the category badges used
 *   throughout the site. Each category reports how many *active* events it
 *   currently has, so the interface can hide or disable empty categories.
 *
 * Why a separate resource instead of /api/events/categories?
 *   A category exists independently of any single event and is referenced by
 *   many events, so it is its own resource with its own collection URL. This is
 *   exactly the kind of URL design the brief asks us to think about.
 * =============================================================================
 */

'use strict';

const express = require('express');
const { query } = require('../event_db');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * GET /api/categories
 * ?withCounts=false  -> omit the live event counters (plain lookup list)
 * ------------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const includeCounts = req.query.withCounts !== 'false';

    // The LEFT JOIN keeps categories that currently have no active events
    // (COUNT returns 0 rather than dropping the row).
    const rows = await query(`
      SELECT
          c.category_id,
          c.category_name,
          c.description,
          COUNT(e.event_id) AS event_count
      FROM categories c
      LEFT JOIN events e
             ON e.category_id = c.category_id
            AND e.status = 'active'
      GROUP BY c.category_id, c.category_name, c.description
      ORDER BY c.category_name ASC
    `);

    const data = rows.map((row) => {
      const category = {
        categoryId: row.category_id,
        categoryName: row.category_name,
        description: row.description
      };
      if (includeCounts) category.eventCount = Number(row.event_count);
      return category;
    });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('[categories] GET / failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve categories.' });
  }
});

module.exports = router;
