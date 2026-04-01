const express = require('express');
const router = express.Router();
const {
    createManualB2CTest,
    generateAIB2CTest,
    getAllB2CTests,
    getB2CTest,
    updateB2CTest,
    toggleB2CTestStatus,
    deleteB2CTest,
    getTestPurchases,
    browseB2CTests,
    getMyB2CTests,
    getB2CTestForExam,
    submitB2CExam,
    getB2CResult
} = require('../controllers/b2cTestController');

const { protect, authorize } = require('../middlewares/auth');
const adminOrSuperAdmin = [protect, authorize('super_admin', 'administrator')];
const userOnly = [protect, authorize('user')];

// ─── ADMIN ROUTES (Super Admin + Administrator) ───────────────────────────────
router.post('/admin/manual', adminOrSuperAdmin, createManualB2CTest);
router.post('/admin/ai-generate', adminOrSuperAdmin, generateAIB2CTest);
router.get('/admin/tests', adminOrSuperAdmin, getAllB2CTests);
router.get('/admin/tests/:testId', adminOrSuperAdmin, getB2CTest);
router.put('/admin/tests/:testId', adminOrSuperAdmin, updateB2CTest);
router.patch('/admin/tests/:testId/status', adminOrSuperAdmin, toggleB2CTestStatus);
router.delete('/admin/tests/:testId', adminOrSuperAdmin, deleteB2CTest);
router.get('/admin/tests/:testId/purchases', adminOrSuperAdmin, getTestPurchases);

// ─── USER ROUTES (Individual B2C Users) ──────────────────────────────────────
router.get('/browse', userOnly, browseB2CTests);
router.get('/my-tests', userOnly, getMyB2CTests);
router.get('/exam/:testId', userOnly, getB2CTestForExam);
router.post('/exam/:testId/submit', userOnly, submitB2CExam);
router.get('/result/:testId', userOnly, getB2CResult);

module.exports = router;
