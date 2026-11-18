const express = require('express');
const router = express.Router();
const {
  getDashboardOverview,
  getAssistant,
  askAssistantQuery,
  checkPurchaseDecision,
  getNeedsVsWants,
  getAnomalies,
  getHealthScore,
  simulateSavings,
  getDailySpendingLimit,
} = require('../controllers/smartController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/assistant', getAssistant);
router.post('/assistant/query', askAssistantQuery);
router.post('/purchase-check', checkPurchaseDecision);
router.get('/needs-wants', getNeedsVsWants);
router.get('/anomalies', getAnomalies);
router.get('/health-score', getHealthScore);
router.post('/simulate', simulateSavings);
router.get('/daily-limit', getDailySpendingLimit);

module.exports = router;
