const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  createGrievance,
  getGrievances,
  getGrievanceById,
  assignToHOD,
  assignToFaculty,
  reassignFaculty,
  updateGrievance,
  createInternalTask,
  getHistory,
} = require('../controllers/grievanceController');

// All routes require authentication
router.use(authMiddleware);

// Student / Portal submission
router.post('/',                 requireRole('Student'),                    upload.single('file'), createGrievance);
// Internal task (Dean / HOD)
router.post('/internal',         requireRole('Dean', 'HOD'),                createInternalTask);
// List grievances (role-filtered inside controller)
router.get('/',                  getGrievances);
// Single grievance + history
router.get('/:id',               getGrievanceById);
// Dean assigns to HOD
router.put('/:id/assign-hod',    requireRole('Dean'),                       assignToHOD);
// HOD / Dean assigns to Faculty
router.put('/:id/assign-faculty',requireRole('HOD', 'Dean'),                assignToFaculty);
// Anyone with update rights can reassign
router.put('/:id/reassign',      requireRole('HOD', 'Dean', 'Faculty'),     reassignFaculty);
// Faculty / HOD / Dean updates status, remark, and attachments (student doc & internal doc)
router.put('/:id/update',        requireRole('Faculty', 'HOD', 'Dean'),     upload.fields([{ name: 'faculty_file', maxCount: 1 }, { name: 'internal_file', maxCount: 1 }]), updateGrievance);
// History
router.get('/:id/history',       getHistory);

module.exports = router;
