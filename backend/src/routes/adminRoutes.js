const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');

// Enforce requireAdmin on ALL admin routes
router.use(authenticate, requireAdmin);

router.get('/overview', adminController.getOverview);
router.get('/properties/approved', adminController.getApprovedProperties);
router.get('/properties', adminController.getReviewQueue);

router.post('/properties/:id/approve', adminController.approveProperty);
router.post('/properties/:id/request-changes', adminController.requestChanges);
router.post('/properties/:id/reject', adminController.rejectProperty);
router.post('/properties/:id/publish', adminController.publishProperty);
router.post('/properties/:id/suspend', adminController.suspendProperty);
router.post('/properties/:id/complete-deal', adminController.completeDeal);
router.patch('/properties/:id/complete-deal', adminController.completeDeal);
router.post('/properties/:id/status', adminController.completeDeal);
router.patch('/properties/:id/status', adminController.completeDeal);

router.get('/audit-logs', adminController.getAuditLogs);
router.get('/users', adminController.getUsers);

// Sales & Escrow Registry (Admin Mediated Deals)
router.get('/escrows', adminController.getEscrows);
router.post('/escrows/:id/release', adminController.releaseEscrow);
router.post('/escrows/:id/freeze', adminController.freezeEscrow);

// Support Helpdesk & Complaints
router.get('/support', adminController.getSupportTickets);
router.post('/support/:id/reply', adminController.replySupportTicket);

module.exports = router;

