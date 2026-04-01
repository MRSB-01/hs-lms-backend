// collegeRoutes.js
const express = require('express');
const router = express.Router();
const { requestAccess } = require('../controllers/collegeController');
const { validate, collegeRules } = require('../middlewares/validate');

router.post('/request', validate(collegeRules), requestAccess);

module.exports = router;
