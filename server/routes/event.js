// server/routes/event.js
'use strict';

const express = require('express');
const router = express.Router();
const ev = require('../event-config');

router.get('/', async (req, res) => {
  try {
    res.json({
      name:     ev.name,
      shortName: ev.shortName,
      date:     ev.date,
      time:     ev.time,
      venue:    ev.venue,
      email:    ev.email,
      capacity: ev.capacity,
      pricing:  ev.pricing,
      bank:     ev.bank,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
