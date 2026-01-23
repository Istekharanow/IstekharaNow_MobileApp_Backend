const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const istekharaQuotaController = require('../controllers/istekharaQuotaController');
const iapController = require('../controllers/iapController');

// Istekhara Quota routescls
router.get('/pricing', istekharaQuotaController.getPricingList);
router.post('/pricing/purchase', authenticate, authorize(['user']), istekharaQuotaController.purchaseQuota);
router.get('/purchases', authenticate, authorize(['user', 'admin']), istekharaQuotaController.listQuotas);
router.get('/remaining', authenticate, authorize(['user']), istekharaQuotaController.getRemainingQuota);
router.delete('/purchases/:id/cancel-subscription', authenticate, authorize(['user']), istekharaQuotaController.cancelSubscription);

//IAP (in app purchase) route
router.post('/iap/purchases', authenticate, authorize(['user']), iapController.validateIAP);


module.exports = router;
