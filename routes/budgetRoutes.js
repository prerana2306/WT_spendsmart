const express = require('express');
const router = express.Router();
const {
  getCurrentBudget,
  getAllBudgets,
  saveBudget,
  deleteBudget,
} = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/current', getCurrentBudget);
router.get('/', getAllBudgets);
router.post('/', saveBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
