const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

router.post('/register', authController.register);
router.post('/check-mobile', authController.checkMobileAvailability);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/resend-verification', authController.resendVerification);
router.post('/check-verification', authController.checkVerificationStatus);
router.post('/verify-link', authController.verifyLink);
router.post('/verify-email', authController.verifyEmail);
router.get('/verify-email', authController.verifyEmailGet);

// Dedicated Email OTP Endpoints
router.post('/email/send-verification-otp', authController.sendEmailVerificationOtp);
router.post('/email/verify-otp', authController.verifyEmailOtp);
router.post('/email/send-reset-otp', authController.sendPasswordResetOtp);
router.post('/email/verify-reset-otp', authController.verifyPasswordResetOtp);

router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/demo-session', authController.issueDemoSession);

// Administrator Multi-Factor Authentication Routes
router.post('/admin/login', authController.adminLogin);
router.post('/admin/verify-mfa', authController.verifyAdminMfa);

router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, authController.updateProfile);

module.exports = router;
