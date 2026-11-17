const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.get('/availability', appointmentController.getSlotAvailability);
router.post('/', appointmentController.createAppointment);
router.get('/', appointmentController.getAppointments);
router.post('/:id/reschedule', appointmentController.rescheduleAppointment);
router.post('/:id/cancel', appointmentController.cancelAppointment);
router.patch('/:id/status', appointmentController.updateAppointmentStatus);

router.post('/inquiries', appointmentController.createInquiry);
router.get('/inquiries', appointmentController.getInquiries);

router.post('/calls', appointmentController.createCallRequest);
router.get('/calls', appointmentController.getCallRequests);
router.patch('/calls/:id/status', appointmentController.updateCallRequestStatus);

router.post('/favorites', appointmentController.toggleFavorite);
router.get('/favorites', appointmentController.getFavorites);

module.exports = router;
