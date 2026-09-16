// server/routes/event.js
'use strict';

const express = require('express');
const router = express.Router();
const ev = require('../event-config');

router.get('/', async (req, res) => {
  try {
    res.json({
      name: ev.name,
      short: ev.short,
      date: ev.date,
      time: ev.time,
      venue: ev.venue,
      email: ev.email,
      capacity: ev.capacity,
      fees: ev.fees,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;