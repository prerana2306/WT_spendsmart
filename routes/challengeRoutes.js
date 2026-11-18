const express = require('express');
const router = express.Router();
const {
  getChallenges,
  joinChallenge,
  checkIn,
} = require('../controllers/challengeController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getChallenges);
router.post('/join', joinChallenge);
router.post('/check-in', checkIn);

module.exports = router;
