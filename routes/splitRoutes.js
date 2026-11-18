const express = require('express');
const router = express.Router();
const {
  getGroups,
  createGroup,
  addMember,
  getGroupDetails,
  addExpense,
  recordSettlement,
} = require('../controllers/splitController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.get('/groups/:id', getGroupDetails);
router.post('/groups/:id/members', addMember);
router.post('/groups/:id/expenses', addExpense);
router.post('/settlements', recordSettlement);

module.exports = router;
