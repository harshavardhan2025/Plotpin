const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getTickets);

module.exports = router;
