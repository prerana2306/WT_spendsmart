const express = require('express');
const router = express.Router();
const {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
} = require('../controllers/goalController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getGoals);
router.post('/', createGoal);
router.get('/:id', getGoalById);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/contributions', addContribution);

module.exports = router;
