const { validationResult, body } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(422).json({ 
        success: false, 
        message: errors.array()[0].msg,
        errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  };
};

const loginRules = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['user', 'student', 'collegeadmin', 'admin', 'superadmin']).withMessage('Invalid role')
];

const courseRules = [
  body('title').trim().notEmpty().withMessage('Course title is required').escape(),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters').escape(),
  body('price').isNumeric().withMessage('Price must be a number').toFloat()
];

const collegeRules = [
  body('name').trim().notEmpty().withMessage('College name is required').escape(),
  body('contactEmail').isEmail().withMessage('Valid official email is required').normalizeEmail(),
  body('contactPhone').trim().isNumeric().withMessage('Phone number must be numeric'),
  body('address').trim().notEmpty().withMessage('Address is required').escape()
];

const studentRules = [
  body('name').trim().notEmpty().withMessage('Student name is required').escape(),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('batchId').isMongoId().withMessage('Invalid batch selected')
];

module.exports = {
  validate,
  loginRules,
  registerRules,
  courseRules,
  collegeRules,
  studentRules
};
