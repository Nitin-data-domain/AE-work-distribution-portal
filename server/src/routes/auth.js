const express = require('express');
const router = express.Router();
const {
  sendRegistrationOTP, register, login, getMe,
  forgotPassword, verifyOTP, resetPassword, changePassword
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/send-otp',         sendRegistrationOTP);
router.post('/register',         register);
router.post('/login',            login);
router.get( '/me',               authMiddleware, getMe);
router.post('/forgot-password',  forgotPassword);
router.post('/verify-otp',       verifyOTP);
router.post('/reset-password',   resetPassword);
router.put( '/change-password',  authMiddleware, changePassword);

module.exports = router;
