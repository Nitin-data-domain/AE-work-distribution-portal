const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole, requireStaffManager } = require('../middleware/auth');
const {
  getFaculty,
  getHODs,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  reassignAndDeleteUser,
  toggleActive,
  updateProfile
} = require('../controllers/userController');

router.use(authMiddleware);

router.get('/faculty',                    getFaculty);
router.get('/hods',                       requireRole('Dean', 'HOD'), getHODs);
router.get('/',                           requireStaffManager,        getAllUsers);
router.post('/',                          requireStaffManager,        createUser);
router.put('/profile',                    updateProfile);
router.put('/:id',                        requireStaffManager,        updateUser);
router.put('/:id/toggle',                 requireStaffManager,        toggleActive);
router.delete('/:id',                     requireStaffManager,        deleteUser);
router.post('/:id/reassign-and-delete',   requireStaffManager,        reassignAndDeleteUser);

module.exports = router;
