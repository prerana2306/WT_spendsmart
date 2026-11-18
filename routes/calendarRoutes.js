const express = require('express');
const router = express.Router();
const {
  getCalendarEvents,
  createReminder,
  updateReminder,
  deleteReminder,
} = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getCalendarEvents);
router.post('/reminders', createReminder);
router.put('/reminders/:id', updateReminder);
router.delete('/reminders/:id', deleteReminder);

module.exports = router;
