const express = require('express');
const router = express.Router();
const { getActiveAnnouncement } = require('../controllers/systemController');

// Public route to get featured announcement
router.get('/announcement', getActiveAnnouncement);

module.exports = router;
