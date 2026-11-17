const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const recommendationController = require('../controllers/recommendationController');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');

// Static routes (must be declared before parameterized :id routes)
router.get('/', optionalAuthenticate, propertyController.searchPublic);
router.get('/nearby', optionalAuthenticate, propertyController.getNearby);
router.post('/recommendations', optionalAuthenticate, recommendationController.getRecommendations);
router.get('/my', authenticate, propertyController.getMyProperties);
router.get('/my/buyings', authenticate, propertyController.getMyBuyings);
router.post('/offers', authenticate, propertyController.createOffer);

// Owner listing lifecycle creation
router.post('/', authenticate, propertyController.createDraft);

// Parameterized :id routes
router.get('/:id', optionalAuthenticate, propertyController.getById);
router.patch('/:id', authenticate, propertyController.updateDraft);
router.delete('/:id', authenticate, propertyController.removeProperty);
router.post('/:id/submit', authenticate, propertyController.submitForReview);
router.post('/:id/complete-deal', authenticate, propertyController.completeDeal);

// Document upload & retrieval endpoints (Owner & Admin only)
router.post('/:id/documents', authenticate, propertyController.uploadDocument);
router.get('/:id/documents', authenticate, propertyController.getDocuments);

module.exports = router;
