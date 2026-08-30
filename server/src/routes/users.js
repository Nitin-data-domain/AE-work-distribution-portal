const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getFaculty, getHODs, getAllUsers, createUser, updateUser, toggleActive, updateProfile
} = require('../controllers/userController');

router.use(authMiddleware);

router.get('/faculty',       getFaculty);
router.get('/hods',          requireRole('Dean', 'HOD'),          getHODs);
router.get('/',              requireRole('Dean', 'HOD'),          getAllUsers);
router.post('/',             requireRole('Dean'),                  createUser);
router.put('/profile',       updateProfile);
router.put('/:id',           requireRole('Dean'),                  updateUser);
router.put('/:id/toggle',    requireRole('Dean', 'HOD'),          toggleActive);

module.exports = router;
