/**
 * =============================================================================
 * PROG2002 Web Development II - Assessment 2
 * routes/organizations.js  -  RESTful endpoint for the "organizations" resource
 * Student: Shengyang Luo (ID: 24832533)
 * =============================================================================
 *
 * GET /api/organizations
 *   Returns the charitable organisations hosted on the platform together with
 *   the number of active events each one is running. The client website uses
 *   this on the Home page's "Who you are supporting" panel.
 *
 * Suspended events are excluded from the counter, so a suspended event never
 * inflates an organisation's public statistics.
 * =============================================================================
 */

'use strict';

const express = require('express');
const { query } = require('../event_db');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * GET /api/organizations
 * ------------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
          o.organization_id,
          o.name,
          o.mission,
          o.description,
          o.email,
          o.phone,
          o.website,
          COUNT(e.event_id) AS active_event_count
      FROM organizations o
      LEFT JOIN events e
             ON e.organization_id = o.organization_id
            AND e.status = 'active'
      GROUP BY o.organization_id, o.name, o.mission, o.description, o.email, o.phone, o.website
      ORDER BY o.name ASC
    `);

    const data = rows.map((row) => ({
      organizationId: row.organization_id,
      name: row.name,
      mission: row.mission,
      description: row.description,
      email: row.email,
      phone: row.phone,
      website: row.website,
      activeEventCount: Number(row.active_event_count)
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('[organizations] GET / failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve organisations.' });
  }
});

module.exports = router;
