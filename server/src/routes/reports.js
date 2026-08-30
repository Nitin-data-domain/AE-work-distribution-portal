const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getSummary, getMonthlyReport, exportExcel, exportGrievancesDetail } = require('../controllers/reportController');

router.use(authMiddleware);
router.use(requireRole('HOD', 'Dean'));

router.get('/summary',           getSummary);
router.get('/monthly',           getMonthlyReport);
router.get('/export',            exportExcel);
router.get('/export-detail',     exportGrievancesDetail);

module.exports = router;
