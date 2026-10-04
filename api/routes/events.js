/**
 * =============================================================================
 * PROG2002 Web Development II - Assessment 2
 * routes/events.js  -  RESTful endpoints for the "events" resource
 * Student: Shengyang Luo (ID: 24832533)
 * =============================================================================
 *
 * Endpoints
 *   GET /api/events                 - list active events (Home page)
 *   GET /api/events/search          - filter active events (Search page)
 *   GET /api/events/locations       - filter options for the location field
 *   GET /api/events/:id             - one event with full detail (Details page)
 *
 * Design decisions (RESTful principles)
 *   - "events" is the resource; the collection lives at /api/events and a single
 *     item at /api/events/:id.
 *   - Reading data is a safe, idempotent operation, so every endpoint uses GET.
 *     The brief states POST/PUT/DELETE are built in Assessment 3.
 *   - /search and /locations are placed BEFORE /:id so Express does not try to
 *     interpret the word "search" as an event id.
 *   - Only rows with status = 'active' are ever returned. Suspended events
 *     (policy breaches) are filtered inside SQL, not in JavaScript, so they can
 *     never leak out of the public API.
 * =============================================================================
 */

'use strict';

const express = require('express');
const { query } = require('../event_db');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * Shared SQL
 * ------------------------------------------------------------------------ */

/**
 * The projection used by every list endpoint.
 *
 * Two derived values are calculated inside MySQL rather than in JavaScript:
 *   time_status     - 'upcoming' or 'past', compared against NOW()
 *   tickets_sold    - confirmed tickets, aggregated from the registrations table
 *   total_raised    - seeded donations + money taken through registrations
 *
 * Computing these in SQL keeps the API response self-contained: the client does
 * not need to re-implement business rules or issue extra requests.
 */
const EVENT_LIST_SELECT = `
  SELECT
      e.event_id,
      e.event_name,
      e.short_summary,
      e.event_date,
      e.end_date,
      e.location_name,
      e.city,
      e.state,
      e.ticket_price,
      e.is_free,
      e.capacity,
      e.goal_amount,
      e.raised_amount,
      e.image_url,
      c.category_id,
      c.category_name,
      o.organization_id,
      o.name        AS organization_name,
      CASE WHEN e.event_date >= NOW() THEN 'upcoming' ELSE 'past' END AS time_status,
      COALESCE(r.tickets_sold, 0)                          AS tickets_sold,
      (e.raised_amount + COALESCE(r.registration_total, 0)) AS total_raised
  FROM events e
  INNER JOIN categories    c ON c.category_id    = e.category_id
  INNER JOIN organizations o ON o.organization_id = e.organization_id
  LEFT JOIN (
      SELECT event_id,
             SUM(tickets)     AS tickets_sold,
             SUM(amount_paid) AS registration_total
      FROM registrations
      WHERE status = 'confirmed'
      GROUP BY event_id
  ) r ON r.event_id = e.event_id
`;

/** Columns that may be requested through the ?sort= parameter (whitelist). */
const SORT_OPTIONS = {
  date_asc: 'e.event_date ASC',
  date_desc: 'e.event_date DESC',
  price_asc: 'e.ticket_price ASC',
  price_desc: 'e.ticket_price DESC',
  name_asc: 'e.event_name ASC',
  goal_desc: 'e.goal_amount DESC'
};

/**
 * Reshapes a raw database row into the JSON contract the client website uses.
 * Number-like DECIMAL columns are cast with Number() because MySQL returns them
 * as strings when they are very large.
 *
 * @param {object} row raw row from MySQL
 * @returns {object} API-ready event object
 */
function toEventSummary(row) {
  return {
    eventId: row.event_id,
    eventName: row.event_name,
    shortSummary: row.short_summary,
    eventDate: row.event_date,
    endDate: row.end_date,
    timeStatus: row.time_status,                 // 'upcoming' | 'past'
    location: {
      name: row.location_name,
      city: row.city,
      state: row.state
    },
    category: {
      categoryId: row.category_id,
      categoryName: row.category_name
    },
    organization: {
      organizationId: row.organization_id,
      name: row.organization_name
    },
    ticketPrice: Number(row.ticket_price),
    isFree: Boolean(row.is_free),
    capacity: row.capacity,
    ticketsSold: Number(row.tickets_sold),
    fundraising: {
      goalAmount: Number(row.goal_amount),
      raisedAmount: Number(row.total_raised),
      progressPercent: row.goal_amount > 0
        ? Math.min(100, Math.round((Number(row.total_raised) / Number(row.goal_amount)) * 100))
        : 0
    },
    imageUrl: row.image_url,
    detailsUrl: `event.html?id=${row.event_id}`
  };
}

/**
 * Turns a YYYY-MM-DD (or full ISO) string into a Date, or null when invalid.
 * @param {string} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formats a Date as YYYY-MM-DD for use inside a SQL comparison. */
function toSqlDate(date) {
  return date.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
 * GET /api/events
 * Home page: every active event, newest first, with optional narrowing.
 * Query params: ?timeStatus=upcoming|past  ?categoryId=1  ?limit=6
 * ------------------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const conditions = ["e.status = 'active'"];
    const params = [];

    // "The website can mark events as 'past' or 'upcoming' based on the event
    //  dates and the current date." - the client may request just one group.
    const timeStatus = (req.query.timeStatus || '').toLowerCase();
    if (timeStatus === 'upcoming') {
      conditions.push('e.event_date >= NOW()');
    } else if (timeStatus === 'past') {
      conditions.push('e.event_date < NOW()');
    }

    if (req.query.categoryId) {
      const categoryId = Number(req.query.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ success: false, message: 'categoryId must be a positive whole number.' });
      }
      conditions.push('e.category_id = ?');
      params.push(categoryId);
    }

    // ?sort= is validated against a whitelist so it can never inject SQL.
    const orderBy = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.date_asc;

    let limitClause = '';
    if (req.query.limit) {
      const limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
        return res.status(400).json({ success: false, message: 'limit must be a whole number between 1 and 100.' });
      }
      limitClause = 'LIMIT ?';
      params.push(limit);
    }

    const sql = `
      ${EVENT_LIST_SELECT}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      ${limitClause}
    `;

    const rows = await query(sql, params);
    const data = rows.map(toEventSummary);

    res.json({
      success: true,
      count: data.length,
      filters: { timeStatus: timeStatus || 'all', categoryId: req.query.categoryId || null },
      data
    });
  } catch (error) {
    console.error('[events] GET / failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve events.' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/events/search
 * Search page: filter active events by date, location and category.
 *
 * Query params (all optional, freely combinable)
 *   dateFilter : upcoming | past | today | this_week | this_month | next_30_days
 *   dateFrom   : YYYY-MM-DD  (custom range start)
 *   dateTo     : YYYY-MM-DD  (custom range end)
 *   location   : free text, matched against city / venue / state
 *   categoryId : one id, or several separated by commas (e.g. 1,4)
 *   organizationId : hosting charity
 *   keyword    : free text searched in the name, summary and description
 *   sort       : date_asc | date_desc | price_asc | price_desc | name_asc | goal_desc
 *
 * Example
 *   /api/events/search?categoryId=1,4&location=coffs&dateFilter=upcoming
 * ------------------------------------------------------------------------ */
router.get('/search', async (req, res) => {
  try {
    const conditions = ["e.status = 'active'"];   // never expose suspended events
    const params = [];
    const appliedFilters = {};

    /* ---- Criterion 1: date ------------------------------------------------ */
    const dateFilter = (req.query.dateFilter || '').toLowerCase().trim();
    const dateFrom = parseDate(req.query.dateFrom);
    const dateTo = parseDate(req.query.dateTo);

    if (req.query.dateFrom && !dateFrom) {
      return res.status(400).json({ success: false, message: 'dateFrom must be a valid date (YYYY-MM-DD).' });
    }
    if (req.query.dateTo && !dateTo) {
      return res.status(400).json({ success: false, message: 'dateTo must be a valid date (YYYY-MM-DD).' });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'dateFrom cannot be later than dateTo.' });
    }

    switch (dateFilter) {
      case '':
        break;                                     // no date criterion selected
      case 'upcoming':
        conditions.push('e.event_date >= NOW()');
        break;
      case 'past':
        conditions.push('e.event_date < NOW()');
        break;
      case 'today':
        conditions.push('DATE(e.event_date) = CURDATE()');
        break;
      case 'this_week':
        // WEEK() with mode 1 makes weeks start on Monday.
        conditions.push('YEARWEEK(e.event_date, 1) = YEARWEEK(CURDATE(), 1)');
        break;
      case 'this_month':
        conditions.push('YEAR(e.event_date) = YEAR(CURDATE()) AND MONTH(e.event_date) = MONTH(CURDATE())');
        break;
      case 'next_30_days':
        conditions.push('e.event_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)');
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unknown dateFilter "${req.query.dateFilter}". Use upcoming, past, today, this_week, this_month or next_30_days.`
        });
    }

    // An explicit calendar range can be combined with (or used instead of) the
    // quick-pick option above.
    if (dateFrom) {
      conditions.push('e.event_date >= ?');
      params.push(`${toSqlDate(dateFrom)} 00:00:00`);
    }
    if (dateTo) {
      // Include the whole of the end day, so 2026-09-28 also matches 6 pm.
      conditions.push('e.event_date <= ?');
      params.push(`${toSqlDate(dateTo)} 23:59:59`);
    }
    if (dateFilter || dateFrom || dateTo) {
      appliedFilters.date = { dateFilter: dateFilter || null, dateFrom: req.query.dateFrom || null, dateTo: req.query.dateTo || null };
    }

    /* ---- Criterion 2: location ------------------------------------------- */
    const location = (req.query.location || '').trim();
    if (location) {
      if (location.length > 80) {
        return res.status(400).json({ success: false, message: 'location must be 80 characters or fewer.' });
      }
      // LIKE with a leading wildcard gives a forgiving "contains" search so
      // "coffs" finds "Coffs Harbour" and "jetty" finds the venue name.
      conditions.push('(e.city LIKE ? OR e.location_name LIKE ? OR e.state LIKE ? OR e.address LIKE ?)');
      const like = `%${location}%`;
      params.push(like, like, like, like);
      appliedFilters.location = location;
    }

    /* ---- Criterion 3: category ------------------------------------------- */
    const categoryParam = (req.query.categoryId || '').toString().trim();
    if (categoryParam) {
      // The Search page lets a user tick several categories, which arrive as
      // "1,4,6" and become an IN (...) clause with one placeholder per id.
      const categoryIds = categoryParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '');

      const invalid = categoryIds.find((value) => !/^\d+$/.test(value) || Number(value) <= 0);
      if (invalid) {
        return res.status(400).json({ success: false, message: 'categoryId must contain only positive whole numbers, e.g. categoryId=1,4' });
      }

      conditions.push(`e.category_id IN (${categoryIds.map(() => '?').join(', ')})`);
      categoryIds.forEach((value) => params.push(Number(value)));
      appliedFilters.categoryIds = categoryIds.map(Number);
    }

    /* ---- Optional filter: hosting organisation --------------------------- */
    const organizationParam = (req.query.organizationId || '').toString().trim();
    if (organizationParam) {
      if (!/^\d+$/.test(organizationParam) || Number(organizationParam) <= 0) {
        return res.status(400).json({ success: false, message: 'organizationId must be a positive whole number.' });
      }
      conditions.push('e.organization_id = ?');
      params.push(Number(organizationParam));
      appliedFilters.organizationId = Number(organizationParam);
    }

    /* ---- Optional keyword bonus ------------------------------------------ */
    const keyword = (req.query.keyword || '').trim();
    if (keyword) {
      if (keyword.length > 100) {
        return res.status(400).json({ success: false, message: 'keyword must be 100 characters or fewer.' });
      }
      conditions.push('(e.event_name LIKE ? OR e.short_summary LIKE ? OR e.description LIKE ? OR o.name LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like, like);
      appliedFilters.keyword = keyword;
    }

    const orderBy = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.date_asc;

    const sql = `
      ${EVENT_LIST_SELECT}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
    `;

    const rows = await query(sql, params);
    const data = rows.map(toEventSummary);

    // A 200 with an empty array is the correct REST response for "no matches".
    // The Search page turns count === 0 into a friendly message for the user.
    res.json({
      success: true,
      count: data.length,
      appliedFilters,
      data
    });
  } catch (error) {
    console.error('[events] GET /search failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not search events.' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/events/locations
 * Supplies the options for the Search page's location control, so the dropdown
 * is generated from live data instead of being hard-coded in the HTML.
 * ------------------------------------------------------------------------ */
router.get('/locations', async (req, res) => {
  try {
    const rows = await query(`
      SELECT e.city,
             e.state,
             COUNT(*) AS event_count
      FROM events e
      WHERE e.status = 'active'
      GROUP BY e.city, e.state
      ORDER BY e.city ASC
    `);

    res.json({
      success: true,
      count: rows.length,
      data: rows.map((row) => ({
        city: row.city,
        state: row.state,
        label: row.state ? `${row.city}, ${row.state}` : row.city,
        eventCount: Number(row.event_count)
      }))
    });
  } catch (error) {
    console.error('[events] GET /locations failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve locations.' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/events/:id
 * Event details page: one active event, every column plus its registration
 * statistics. Returns 404 for unknown ids AND for suspended events.
 * ------------------------------------------------------------------------ */
router.get('/:id', async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    // Validate before touching the database - a clear 400 beats a silent NULL.
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: 'Event id must be a positive whole number.' });
    }

    const rows = await query(`
      SELECT
          e.*,
          c.category_name,
          c.description      AS category_description,
          o.name             AS organization_name,
          o.mission          AS organization_mission,
          o.description      AS organization_description,
          o.email            AS organization_email,
          o.phone            AS organization_phone,
          o.website          AS organization_website,
          CASE WHEN e.event_date >= NOW() THEN 'upcoming' ELSE 'past' END AS time_status,
          COALESCE(r.tickets_sold, 0)                           AS tickets_sold,
          COALESCE(r.registration_count, 0)                     AS registration_count,
          (e.raised_amount + COALESCE(r.registration_total, 0)) AS total_raised
      FROM events e
      INNER JOIN categories    c ON c.category_id     = e.category_id
      INNER JOIN organizations o ON o.organization_id = e.organization_id
      LEFT JOIN (
          SELECT event_id,
                 SUM(tickets)     AS tickets_sold,
                 SUM(amount_paid) AS registration_total,
                 COUNT(*)         AS registration_count
          FROM registrations
          WHERE status = 'confirmed'
          GROUP BY event_id
      ) r ON r.event_id = e.event_id
      WHERE e.event_id = ? AND e.status = 'active'
    `, [eventId]);

    if (rows.length === 0) {
      // A suspended event produces exactly the same response as a missing one:
      // the public cannot tell the difference, which is the point of suspension.
      return res.status(404).json({
        success: false,
        message: `No active event found with id ${eventId}.`
      });
    }

    const row = rows[0];
    const goal = Number(row.goal_amount);
    const raised = Number(row.total_raised);
    const remaining = Math.max(0, goal - raised);

    res.json({
      success: true,
      data: {
        eventId: row.event_id,
        eventName: row.event_name,
        shortSummary: row.short_summary,
        description: row.description,
        eventDate: row.event_date,
        endDate: row.end_date,
        timeStatus: row.time_status,
        location: {
          name: row.location_name,
          address: row.address,
          city: row.city,
          state: row.state
        },
        category: {
          categoryId: row.category_id,
          categoryName: row.category_name,
          description: row.category_description
        },
        organization: {
          organizationId: row.organization_id,
          name: row.organization_name,
          mission: row.organization_mission,
          description: row.organization_description,
          email: row.organization_email,
          phone: row.organization_phone,
          website: row.organization_website
        },
        tickets: {
          price: Number(row.ticket_price),
          isFree: Boolean(row.is_free),
          capacity: row.capacity,
          ticketsSold: Number(row.tickets_sold),
          registrationCount: Number(row.registration_count),
          // null capacity means "unlimited", which the UI shows as no limit.
          remaining: row.capacity === null ? null : Math.max(0, row.capacity - Number(row.tickets_sold)),
          priceLabel: Boolean(row.is_free) ? 'Free entry' : `$${Number(row.ticket_price).toFixed(2)} per ticket`
        },
        fundraising: {
          goalAmount: goal,
          raisedAmount: raised,
          remainingAmount: remaining,
          progressPercent: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
        },
        imageUrl: row.image_url,
        createdAt: row.created_at
      }
    });
  } catch (error) {
    console.error(`[events] GET /${req.params.id} failed:`, error.message);
    res.status(500).json({ success: false, message: 'Could not retrieve the event.' });
  }
});

module.exports = router;
