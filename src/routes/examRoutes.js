const express = require('express');
const router = express.Router();
const { createTest, getTest, submitTest } = require('../controllers/examController');
const { protect, authorize } = require('../middlewares/auth');

router.post('/', protect, authorize('super_admin', 'administrator'), createTest);
router.get('/:id', protect, getTest);
router.post('/submit', protect, submitTest);

module.exports = router;
