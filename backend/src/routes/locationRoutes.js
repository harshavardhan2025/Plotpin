const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.get('/search', locationController.search);
router.get('/reverse', locationController.reverse);

module.exports = router;

