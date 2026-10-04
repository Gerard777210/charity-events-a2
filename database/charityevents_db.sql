-- =============================================================================
-- PROG2002 Web Development II - Assessment 2
-- Charity Events Website - Database Schema
-- Student: Shengyang Luo (ID: 24832533)
--
-- File     : charityevents_db.sql
-- Database : charityevents_db
-- Engine   : MySQL 8.x (InnoDB, utf8mb4)
--
-- HOW TO IMPORT
--   1. Open MySQL Workbench and connect to your local server.
--   2. Server > Data Import > Import from Self-Contained File > select this file.
--      (or) open this file in a query tab and press the lightning-bolt "Execute".
--   3. Run the statements in order: this script creates the database, the
--      tables, the relationships and then a realistic sample dataset.
--
-- NOTE ON DATES
--   Sample event dates are generated relative to CURDATE() so that the
--   "upcoming" versus "past" behaviour of the website is always demonstrable,
--   no matter which day the marker imports this file.
-- =============================================================================

DROP DATABASE IF EXISTS charityevents_db;

CREATE DATABASE charityevents_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE charityevents_db;

-- -----------------------------------------------------------------------------
-- Table 1: categories
-- Lookup table for the type of fundraising activity (fun run, gala, ...).
-- Kept separate from events so an event category can be filtered, renamed or
-- reused by many events without repeating text in every row (3rd normal form).
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    category_id   INT           NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(60)   NOT NULL,
    description   VARCHAR(255)  NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_categories_name (category_name)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Table 2: organizations
-- The charitable organisation that hosts an event. One organisation can host
-- many events, so the foreign key lives on the events table (1:M).
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
    organization_id INT           NOT NULL AUTO_INCREMENT,
    name            VARCHAR(120)  NOT NULL,
    mission         VARCHAR(255)  NULL,
    description     TEXT          NULL,
    email           VARCHAR(120)  NULL,
    phone           VARCHAR(30)   NULL,
    website         VARCHAR(200)  NULL,
    PRIMARY KEY (organization_id),
    UNIQUE KEY uq_organizations_name (name)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Table 3: events
-- The central entity of the case study. Holds everything the public website
-- needs to render a summary card and a full event detail page.
--
--   status     : 'active'    -> published and visible on the public website
--                'suspended' -> violates policy, never returned by the public
--                               API endpoints (hidden from Home and Search)
--   goal_amount: the fundraising target displayed as "Goal vs. Progress"
--   raised_amount: donations already banked before this website went live.
--                  The API adds confirmed ticket registrations to this figure,
--                  so progress grows as the public registers (see Part 1/2).
-- -----------------------------------------------------------------------------
CREATE TABLE events (
    event_id         INT            NOT NULL AUTO_INCREMENT,
    event_name       VARCHAR(150)   NOT NULL,
    short_summary    VARCHAR(255)   NULL,
    description      TEXT           NULL,
    event_date       DATETIME       NOT NULL,
    end_date         DATETIME       NULL,
    location_name    VARCHAR(150)   NOT NULL,
    address          VARCHAR(200)   NULL,
    city             VARCHAR(80)    NOT NULL,
    state            CHAR(3)        NULL,
    category_id      INT            NOT NULL,
    organization_id  INT            NOT NULL,
    ticket_price     DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_free          TINYINT(1)     NOT NULL DEFAULT 0,
    capacity         INT            NULL,
    goal_amount      DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    raised_amount    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    image_url        VARCHAR(255)   NULL,
    status           ENUM('active','suspended') NOT NULL DEFAULT 'active',
    created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    KEY idx_events_date (event_date),
    KEY idx_events_city (city),
    KEY idx_events_status_date (status, event_date),
    CONSTRAINT fk_events_category
        FOREIGN KEY (category_id) REFERENCES categories (category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_events_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (organization_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_events_goal   CHECK (goal_amount   >= 0),
    CONSTRAINT chk_events_raised CHECK (raised_amount >= 0),
    CONSTRAINT chk_events_price  CHECK (ticket_price  >= 0)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- Table 4: registrations
-- Ticket purchases / donations made through the website. Assessment 3 will
-- create these records with a POST endpoint; Assessment 2 seeds a handful of
-- confirmed rows so the "Goal vs. Progress" bar on the detail page is driven by
-- real relational data instead of a hard-coded percentage.
-- -----------------------------------------------------------------------------
CREATE TABLE registrations (
    registration_id  INT            NOT NULL AUTO_INCREMENT,
    event_id         INT            NOT NULL,
    attendee_name    VARCHAR(120)   NOT NULL,
    attendee_email   VARCHAR(150)   NOT NULL,
    tickets          INT            NOT NULL DEFAULT 1,
    amount_paid      DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    registration_date DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
    PRIMARY KEY (registration_id),
    KEY idx_registrations_event (event_id),
    CONSTRAINT fk_registrations_event
        FOREIGN KEY (event_id) REFERENCES events (event_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_registrations_tickets CHECK (tickets > 0)
) ENGINE = InnoDB;

-- =============================================================================
-- SAMPLE DATA
-- =============================================================================

-- 7 categories -----------------------------------------------------------------
INSERT INTO categories (category_name, description) VALUES
('Fun Run',            'Timed or social runs and walks that raise money through entry fees and sponsorship.'),
('Gala Dinner',        'Formal evening dinners with entertainment, auctions and guest speakers.'),
('Silent Auction',     'Bidding events where supporters compete for donated items and experiences.'),
('Charity Concert',    'Live music performances where every ticket sold supports the cause.'),
('Community Festival', 'Family-friendly open-air festivals with food stalls, games and performances.'),
('Charity Cycling',    'Sponsored bike rides and cycling challenges across the region.'),
('Trivia Night',       'Team quiz evenings hosted by local businesses and community groups.');

-- 6 charitable organisations ---------------------------------------------------
INSERT INTO organizations (name, mission, description, email, phone, website) VALUES
('Harbour Lights Foundation',
 'To bring light and practical support to families facing hardship along the coast.',
 'Founded in 2009, the Harbour Lights Foundation supports families in crisis with emergency accommodation, food relief and counselling. Every dollar raised stays in the local region.',
 'hello@harbourlights.org.au', '02 6600 1200', 'https://www.harbourlights.org.au'),
('Green Horizon Trust',
 'To restore and protect native bushland for the generations who come after us.',
 'Green Horizon Trust works with local councils and volunteers to replant native corridors, run bush regeneration days and deliver environmental education in schools.',
 'contact@greenhorizontrust.org.au', '02 6600 4510', 'https://www.greenhorizontrust.org.au'),
('Bright Future Education Fund',
 'To make sure no student misses out on education because of the cost.',
 'Bright Future provides scholarships, laptops and school supplies to students from low-income households, and funds tutoring programs in regional schools.',
 'info@brightfuturefund.org.au', '02 6600 7788', 'https://www.brightfuturefund.org.au'),
('Paws and Hearts Rescue',
 'To rescue, rehabilitate and rehome abandoned companion animals.',
 'Paws and Hearts Rescue operates a no-kill shelter, a foster network of over 200 families and a subsidised desexing program for pet owners in need.',
 'adopt@pawsandhearts.org.au', '02 6600 3344', 'https://www.pawsandhearts.org.au'),
('Coastal Health Alliance',
 'To improve access to mental health care in regional and remote communities.',
 'Coastal Health Alliance funds rural mental health nurses, peer-support groups and a 24-hour telephone support line for people living outside major cities.',
 'support@coastalhealth.org.au', '02 6600 9021', 'https://www.coastalhealth.org.au'),
('Shelter and Warmth Mission',
 'To end homelessness in our region, one person at a time.',
 'Shelter and Warmth Mission runs an emergency night shelter, a housing-first program and a mobile shower and laundry service for people sleeping rough.',
 'care@shelterandwarmth.org.au', '02 6600 6633', 'https://www.shelterandwarmth.org.au');

-- 12 charity events -----------------------------------------------------------
-- 10 active (6 upcoming, 4 past) + 2 suspended (policy breaches).
-- Dates are offsets from CURDATE() so the dataset is always relevant.
INSERT INTO events
(event_name, short_summary, description, event_date, end_date, location_name, address, city, state,
 category_id, organization_id, ticket_price, is_free, capacity, goal_amount, raised_amount, image_url, status)
VALUES
-- 1. Upcoming ---------------------------------------------------------------
('Sunrise Coastal Fun Run 2026',
 'A 5 km and 10 km sunrise run along the beachfront to fund family crisis accommodation.',
 'Lace up for the most scenic start line on the coast. The Sunrise Coastal Fun Run offers a 5 km family walk and a chip-timed 10 km run along the beachfront promenade, finishing with a free community breakfast. Every entry fee is donated directly to the Harbour Lights Foundation emergency accommodation program, which housed 214 families last year. Walkers, runners, prams and well-behaved dogs are all welcome. Medals are awarded in eight age categories, and the first 500 registrations receive a commemorative event singlet.',
 DATE_ADD(CURDATE(), INTERVAL 12 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY),
 'Coastal Promenade Reserve', '1 Marine Parade', 'Coffs Harbour', 'NSW',
 1, 1, 45.00, 0, 1500, 60000.00, 23450.00, 'assets/event-funrun.svg', 'active'),

-- 2. Upcoming ---------------------------------------------------------------
('Harbour Lights Gala Dinner',
 'An elegant three-course dinner with live music, a keynote speaker and a major prize draw.',
 'Join 300 guests for an unforgettable evening of fine dining and generosity. The Harbour Lights Gala Dinner features a three-course meal designed by award-winning local chef Marina Duval, live jazz from the Coastal Quartet, and a keynote address from family support worker Dr Aisha Rahman. The evening concludes with a major prize draw including a seven-night Great Barrier Reef holiday. All proceeds fund the Foundation''s counselling service, which delivers over 4,000 free sessions each year. Tables of ten can be reserved, and a vegetarian, vegan and gluten-free menu is available on request.',
 DATE_ADD(CURDATE(), INTERVAL 26 DAY), DATE_ADD(CURDATE(), INTERVAL 26 DAY),
 'The Jetty Grand Ballroom', '88 Harbour Esplanade', 'Coffs Harbour', 'NSW',
 2, 1, 180.00, 0, 300, 90000.00, 41800.00, 'assets/event-gala.svg', 'active'),

-- 3. Upcoming ---------------------------------------------------------------
('Bushland Restoration Day',
 'A hands-on morning of tree planting and habitat repair. Free entry, all tools supplied.',
 'Spend a rewarding morning putting 2,000 native seedlings into the ground at Boambee Creek. Green Horizon Trust rangers guide small teams through planting, mulching and weed control, and explain how each species supports local koala and bird populations. This is a free community event suitable for ages eight and above; children must be accompanied by an adult. Tools, gloves, sunscreen and a barbecue lunch are provided. Volunteers who raise $50 or more in sponsorship receive a limited-edition Green Horizon hat and a certificate of appreciation.',
 DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY),
 'Boambee Creek Reserve', '45 Sawtell Road', 'Toormina', 'NSW',
 5, 2, 0.00, 1, 400, 25000.00, 9870.00, 'assets/event-festival.svg', 'active'),

-- 4. Upcoming ---------------------------------------------------------------
('Pedal for Pencils Charity Ride',
 'Choose 25 km, 60 km or the 100 km century ride through the hinterland to fund student scholarships.',
 'Pedal for Pencils is the region''s favourite charity cycling challenge. Three supported routes wind through the hinterland: a flat 25 km family loop, a rolling 60 km challenge and the demanding 100 km century with 1,400 m of climbing. Every route has marshals, mechanical support and hydration stations. Registration includes a timing chip, a finisher medal and a recovery lunch. Funds raised provide laptops, textbooks and tutoring to students who would otherwise leave school early.',
 DATE_ADD(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 40 DAY),
 'Bellingen Showground', '12 Park Street', 'Bellingen', 'NSW',
 6, 3, 75.00, 0, 800, 75000.00, 31200.00, 'assets/event-cycle.svg', 'active'),

-- 5. Upcoming ---------------------------------------------------------------
('Paws and Hearts Trivia Night',
 'Six rounds, great prizes and a table full of laughs in support of rescue animals.',
 'Grab nine friends and test your general knowledge for a very good cause. The Paws and Hearts Trivia Night runs six rounds of questions hosted by local comedian Toby Nguyen, with a silent auction of donated prizes between rounds. Tables are $200 for a team of ten and include a grazing platter. There is also a best-dressed-table prize, so bring your themed decorations. Every dollar raised goes to the shelter''s veterinary fund, which covered 612 desexing procedures and 340 emergency treatments last year.',
 DATE_ADD(CURDATE(), INTERVAL 18 DAY), DATE_ADD(CURDATE(), INTERVAL 18 DAY),
 'Sawtell Memorial Hall', '3 First Avenue', 'Sawtell', 'NSW',
 7, 4, 20.00, 0, 240, 20000.00, 7350.00, 'assets/event-trivia.svg', 'active'),

-- 6. Upcoming ---------------------------------------------------------------
('Voices for Mental Health Concert',
 'An open-air concert featuring five regional acts, raising funds for rural mental health nursing.',
 'Voices for Mental Health brings five of the region''s best-loved acts to the harbour stage for one powerful evening. Gates open at 4 pm with food trucks and a wellbeing expo, and the headline set finishes under lights at 9 pm. The concert raises money for Coastal Health Alliance mental health nurses, who currently serve 38 regional towns. Tickets are $60 for adults and free for under-16s accompanied by an adult. This is an alcohol-free, fully accessible event with a quiet sensory space available.',
 DATE_ADD(CURDATE(), INTERVAL 55 DAY), DATE_ADD(CURDATE(), INTERVAL 55 DAY),
 'Harbour Amphitheatre', '2 Marina Drive', 'Coffs Harbour', 'NSW',
 4, 5, 60.00, 0, 2200, 120000.00, 54600.00, 'assets/event-concert.svg', 'active'),

-- 7. Past -------------------------------------------------------------------
('Winter Warmth Silent Auction',
 'A curated silent auction of art, wine and weekend escapes that funded the winter night shelter.',
 'Our Winter Warmth Silent Auction brought together 120 donated lots, from original works by local artists to cellar-door wine collections and weekend escapes. Bidding ran online for ten days and closed with a live auction night at the Gallery. The auction raised funds for the Shelter and Warmth Mission night shelter, which provided 3,900 safe bed nights during the coldest months. Thank you to every bidder, donor and volunteer who made this possible.',
 DATE_SUB(CURDATE(), INTERVAL 24 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY),
 'Regional Art Gallery', '17 Coff Street', 'Coffs Harbour', 'NSW',
 3, 6, 35.00, 0, 350, 45000.00, 45000.00, 'assets/event-auction.svg', 'active'),

-- 8. Past -------------------------------------------------------------------
('Community Harvest Festival 2025',
 'A free family festival that brought 4,000 people together and filled the food relief pantry.',
 'The Community Harvest Festival transformed the showground into a day of food stalls, farm animals, cooking demonstrations and live music. Entry was free, with visitors invited to bring non-perishable food or make a gold-coin donation. The festival collected 6.2 tonnes of groceries for the Harbour Lights food relief pantry and hosted 42 local producers. Thank you to the 180 volunteers who made the day run so smoothly.',
 DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 60 DAY),
 'Coffs Harbour Showground', '123 Pacific Highway', 'Coffs Harbour', 'NSW',
 5, 1, 0.00, 1, 5000, 30000.00, 30000.00, 'assets/event-festival.svg', 'active'),

-- 9. Past -------------------------------------------------------------------
('Twilight Beach Clean and Run',
 'An evening clean-up followed by a 3 km twilight dash along the foreshore.',
 'Volunteers removed 480 kg of litter and marine debris from the foreshore before taking on a relaxed 3 km twilight dash at sunset. The event combined practical environmental action with a celebration of the coastline we are protecting. Green Horizon Trust used the funds raised to install three new litter traps in the creek catchment and to sponsor a school education program reaching 900 students.',
 DATE_SUB(CURDATE(), INTERVAL 100 DAY), DATE_SUB(CURDATE(), INTERVAL 100 DAY),
 'Jetty Foreshore Reserve', 'Jordan Esplanade', 'Coffs Harbour', 'NSW',
 1, 2, 15.00, 0, 600, 18000.00, 18000.00, 'assets/event-funrun.svg', 'active'),

-- 10. Past ------------------------------------------------------------------
('Spring Scholarship Luncheon',
 'A long lunch that fully funded twelve regional student scholarships for the year ahead.',
 'The Spring Scholarship Luncheon welcomed 160 guests to a three-course lunch with presentations from three current scholarship recipients. The event reached its fundraising target in a single afternoon, fully funding twelve scholarships covering laptops, textbooks, travel and tutoring. Bright Future Education Fund has now supported 148 students since 2016, with an 94 per cent year-12 completion rate among recipients.',
 DATE_SUB(CURDATE(), INTERVAL 150 DAY), DATE_SUB(CURDATE(), INTERVAL 150 DAY),
 'Bellingen Community Hall', '9 Hyde Street', 'Bellingen', 'NSW',
 2, 3, 120.00, 0, 200, 55000.00, 58200.00, 'assets/event-gala.svg', 'active'),

-- 11. Suspended (policy breach) ---------------------------------------------
('Unauthorised Prize Draw Night',
 'Suspended pending review of fundraising licence compliance.',
 'This event was submitted without a valid fundraising licence number and has been suspended by the platform administrator pending review. It does not appear on the public Home or Search pages.',
 DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
 'Unverified Venue', '0 Unknown Road', 'Coffs Harbour', 'NSW',
 7, 6, 25.00, 0, 200, 15000.00, 0.00, 'assets/event-trivia.svg', 'suspended'),

-- 12. Suspended (policy breach) --------------------------------------------
('Unregistered Cash Collection Drive',
 'Suspended: collection permit could not be verified against the state register.',
 'This event was suspended because the organisation could not produce a valid street collection permit. The platform suspends any event that breaches fundraising policy, and suspended events are filtered out of every public API response.',
 DATE_ADD(CURDATE(), INTERVAL 45 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY),
 'Unverified Venue', '0 Unknown Road', 'Port Macquarie', 'NSW',
 3, 6, 0.00, 1, 100, 10000.00, 0.00, 'assets/event-auction.svg', 'suspended');

-- 24 confirmed registrations ---------------------------------------------------
-- These drive the "Goal vs. Progress" figure together with events.raised_amount.
INSERT INTO registrations (event_id, attendee_name, attendee_email, tickets, amount_paid, registration_date, status) VALUES
(1, 'Amelia Hart',      'amelia.hart@example.com',      2,  90.00, DATE_SUB(NOW(), INTERVAL 9 DAY),  'confirmed'),
(1, 'Noah Bennett',     'noah.bennett@example.com',     1,  45.00, DATE_SUB(NOW(), INTERVAL 8 DAY),  'confirmed'),
(1, 'Chloe Ramsay',     'chloe.ramsay@example.com',     4, 180.00, DATE_SUB(NOW(), INTERVAL 6 DAY),  'confirmed'),
(1, 'Ethan Wallace',    'ethan.wallace@example.com',    1,  45.00, DATE_SUB(NOW(), INTERVAL 3 DAY),  'confirmed'),
(1, 'Cancelled Tester', 'cancel.test@example.com',      1,  45.00, DATE_SUB(NOW(), INTERVAL 2 DAY),  'cancelled'),
(2, 'Priya Nair',       'priya.nair@example.com',       2, 360.00, DATE_SUB(NOW(), INTERVAL 14 DAY), 'confirmed'),
(2, 'Marcus Lee',       'marcus.lee@example.com',       4, 720.00, DATE_SUB(NOW(), INTERVAL 11 DAY), 'confirmed'),
(2, 'Sophie Tran',      'sophie.tran@example.com',      1, 180.00, DATE_SUB(NOW(), INTERVAL 5 DAY),  'confirmed'),
(3, 'Grace Okafor',     'grace.okafor@example.com',     3,  75.00, DATE_SUB(NOW(), INTERVAL 7 DAY),  'confirmed'),
(3, 'Liam Doyle',       'liam.doyle@example.com',       2,  50.00, DATE_SUB(NOW(), INTERVAL 4 DAY),  'confirmed'),
(4, 'Isabella Moore',   'isabella.moore@example.com',   1,  75.00, DATE_SUB(NOW(), INTERVAL 13 DAY), 'confirmed'),
(4, 'Jack Petrov',      'jack.petrov@example.com',      2, 150.00, DATE_SUB(NOW(), INTERVAL 10 DAY), 'confirmed'),
(4, 'Hannah Wu',        'hannah.wu@example.com',        1,  75.00, DATE_SUB(NOW(), INTERVAL 6 DAY),  'confirmed'),
(5, 'Oliver Grant',     'oliver.grant@example.com',    10, 200.00, DATE_SUB(NOW(), INTERVAL 12 DAY), 'confirmed'),
(5, 'Mia Sanderson',    'mia.sanderson@example.com',   10, 200.00, DATE_SUB(NOW(), INTERVAL 4 DAY),  'confirmed'),
(6, 'Ruby Fitzgerald',  'ruby.fitz@example.com',        2, 120.00, DATE_SUB(NOW(), INTERVAL 15 DAY), 'confirmed'),
(6, 'Daniel Kim',       'daniel.kim@example.com',       4, 240.00, DATE_SUB(NOW(), INTERVAL 12 DAY), 'confirmed'),
(6, 'Zara Hussain',     'zara.hussain@example.com',     2, 120.00, DATE_SUB(NOW(), INTERVAL 8 DAY),  'confirmed'),
(7, 'Tom Ashford',      'tom.ashford@example.com',      2,  70.00, DATE_SUB(NOW(), INTERVAL 30 DAY), 'confirmed'),
(8, 'Ella Novak',       'ella.novak@example.com',       5,  25.00, DATE_SUB(NOW(), INTERVAL 62 DAY), 'confirmed'),
(9, 'Ryan Mitchell',    'ryan.mitchell@example.com',    3,  45.00, DATE_SUB(NOW(), INTERVAL 102 DAY),'confirmed'),
(10,'Ava Lindqvist',    'ava.lindqvist@example.com',    2, 240.00, DATE_SUB(NOW(), INTERVAL 152 DAY),'confirmed'),
(10,'Ben Carter',       'ben.carter@example.com',       2, 240.00, DATE_SUB(NOW(), INTERVAL 148 DAY),'confirmed'),
(2, 'Late Cancellation','late.cancel@example.com',      2, 360.00, DATE_SUB(NOW(), INTERVAL 1 DAY),  'cancelled');

-- =============================================================================
-- Quick verification queries (optional - run these to prove the import worked)
-- =============================================================================
-- SELECT COUNT(*) AS total_events FROM events;                       -- expect 12
-- SELECT COUNT(*) AS public_events FROM events WHERE status='active'; -- expect 10
-- SELECT COUNT(*) AS categories FROM categories;                     -- expect 7
-- SELECT COUNT(*) AS organisations FROM organizations;               -- expect 6
-- SELECT COUNT(*) AS registrations FROM registrations;               -- expect 24
