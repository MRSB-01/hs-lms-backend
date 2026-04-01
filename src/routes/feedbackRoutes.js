const express = require('express');
const router = express.Router();
const { 
  createFeedback, 
  getVisibleFeedback, 
  getAllFeedback, 
  deleteFeedback, 
  toggleVisibility 
} = require('../controllers/feedbackController');
const { superAdminMiddleware } = require('../middlewares/roleMiddleware');

// Public routes
router.post('/', createFeedback);
router.get('/public', getVisibleFeedback);

// Protected routes (Super Admin only)
router.get('/', superAdminMiddleware, getAllFeedback);
router.delete('/:id', superAdminMiddleware, deleteFeedback);
router.patch('/:id/visibility', superAdminMiddleware, toggleVisibility);

module.exports = router;
