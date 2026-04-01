const Feedback = require('../models/Feedback');

/**
 * @desc Create new feedback
 * @route POST /api/feedback
 * @access Public
 */
exports.createFeedback = async (req, res) => {
  try {
    const { name, email, role, rating, message } = req.body;
    
    // Proper validation
    if (!name || !email || !rating || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, rating, and message are required fields.' 
      });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating must be a number between 1 and 5.' 
      });
    }

    const feedback = await Feedback.create({
      name,
      email,
      role: role || 'Other',
      rating,
      message,
      isVisible: true // Default as per requirement
    });

    res.status(201).json({ 
      success: true, 
      message: 'Feedback submitted successfully',
      feedback 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get visible feedback for home page
 * @route GET /api/feedback/public
 * @access Public
 */
exports.getVisibleFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ isVisible: true }).sort('-createdAt');
    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all feedback for Super Admin
 * @route GET /api/feedback
 * @access Protected (Super Admin)
 */
exports.getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort('-createdAt');
    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete feedback
 * @route DELETE /api/feedback/:id
 * @access Protected (Super Admin)
 */
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    res.status(200).json({ success: true, message: 'Feedback deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Toggle feedback visibility
 * @route PATCH /api/feedback/:id/visibility
 * @access Protected (Super Admin)
 */
exports.toggleVisibility = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    feedback.isVisible = !feedback.isVisible;
    await feedback.save();
    res.status(200).json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
