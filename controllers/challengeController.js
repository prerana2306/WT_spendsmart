const Challenge = require('../models/Challenge');
const ChallengeProgress = require('../models/ChallengeProgress');
const Badge = require('../models/Badge');
const { createInAppNotification } = require('../services/notificationService');

// System default challenges definition
const DEFAULT_CHALLENGES = [
  {
    code: 'no-spend-weekend',
    title: 'No-Spend Weekend',
    description: 'Keep your weekend spending at exactly ₹0 on all non-essential items.',
    category: 'No-Spend',
    durationDays: 2,
    badgeTier: 'Bronze Saver',
    icon: 'coffee',
  },
  {
    code: 'save-500-week',
    title: 'Save ₹500 This Week',
    description: 'Deposit or retain ₹500 in savings across the next 7 days.',
    category: 'Saving Amount',
    durationDays: 7,
    targetAmount: 500,
    badgeTier: 'Bronze Saver',
    icon: 'piggy-bank',
  },
  {
    code: 'saving-streak-7',
    title: '7-Day Saving Streak',
    description: 'Log in and stay within your daily spending limit for 7 consecutive days.',
    category: 'Streak',
    durationDays: 7,
    badgeTier: 'Silver Saver',
    icon: 'flame',
  },
  {
    code: 'avoid-food-delivery',
    title: 'Avoid Food Delivery for 5 Days',
    description: 'No Zomato or Swiggy for 5 weekdays! Eat at the campus mess or cook with roommates.',
    category: 'Category Restriction',
    durationDays: 5,
    targetCategory: 'Food',
    badgeTier: 'Silver Saver',
    icon: 'utensils',
  },
  {
    code: 'save-100-daily',
    title: 'Save ₹100 Every Day',
    description: 'Transfer or set aside ₹100 daily for 10 days to build the daily savings habit.',
    category: 'Saving Amount',
    durationDays: 10,
    targetAmount: 1000,
    badgeTier: 'Gold Saver',
    icon: 'coins',
  },
  {
    code: 'money-master-30',
    title: '30-Day Money Master',
    description: 'Stay within your monthly budget and log all transactions consistently for a full month.',
    category: 'Milestone',
    durationDays: 30,
    badgeTier: 'Money Master',
    icon: 'crown',
  },
];

// Helper to ensure default challenges exist in DB
async function seedDefaultChallenges() {
  for (const c of DEFAULT_CHALLENGES) {
    await Challenge.findOneAndUpdate({ code: c.code }, c, { upsert: true });
  }
}

// @desc    Get all challenges and user progress
// @route   GET /api/challenges
exports.getChallenges = async (req, res, next) => {
  try {
    await seedDefaultChallenges();

    const challenges = await Challenge.find().sort('durationDays');
    const userProgress = await ChallengeProgress.find({ user: req.user.id })
      .populate('challenge')
      .sort('-createdAt');

    const userBadges = await Badge.find({ user: req.user.id }).sort('-awardedAt');

    res.status(200).json({
      success: true,
      data: {
        challenges,
        userProgress,
        userBadges,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join a challenge
// @route   POST /api/challenges/join
exports.joinChallenge = async (req, res, next) => {
  try {
    const { challengeId } = req.body;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found.' });
    }

    // Check if active progress already exists
    const existing = await ChallengeProgress.findOne({
      user: req.user.id,
      challenge: challengeId,
      status: 'active',
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this challenge and it is currently active!',
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + challenge.durationDays);

    const progress = await ChallengeProgress.create({
      user: req.user.id,
      challenge: challengeId,
      startDate,
      endDate,
      status: 'active',
      checkIns: [],
      currentStreak: 0,
    });

    await createInAppNotification({
      userId: req.user.id,
      title: 'Challenge Accepted!',
      message: `You started the '${challenge.title}' challenge. Let's conquer it!`,
      type: 'challenge',
      link: '/challenges.html',
    });

    res.status(201).json({
      success: true,
      message: `Joined '${challenge.title}' successfully!`,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Daily Check-in for active challenge
// @route   POST /api/challenges/check-in
exports.checkIn = async (req, res, next) => {
  try {
    const { progressId, savedAmount, note } = req.body;

    const progress = await ChallengeProgress.findOne({
      _id: progressId,
      user: req.user.id,
      status: 'active',
    }).populate('challenge');

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Active challenge progress not found.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const alreadyCheckedIn = progress.checkIns.some((c) => c.date === todayStr);
    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for today! Come back tomorrow for your next check-in.',
      });
    }

    // Add check-in
    progress.checkIns.push({
      date: todayStr,
      completed: true,
      savedAmount: parseFloat(savedAmount) || 0,
      note: note ? note.trim() : '',
      checkedInAt: new Date(),
    });

    progress.currentStreak += 1;

    // Check if challenge duration requirement is met
    if (progress.checkIns.length >= progress.challenge.durationDays) {
      progress.status = 'completed';

      // Award badge if not already awarded
      if (!progress.isBadgeAwarded) {
        progress.isBadgeAwarded = true;

        await Badge.findOneAndUpdate(
          { user: req.user.id, code: progress.challenge.code },
          {
            user: req.user.id,
            code: progress.challenge.code,
            title: `${progress.challenge.title} Champion`,
            description: `Successfully completed the ${progress.challenge.title} challenge.`,
            tier: progress.challenge.badgeTier,
            icon: progress.challenge.icon,
            awardedAt: new Date(),
          },
          { upsert: true }
        );

        await createInAppNotification({
          userId: req.user.id,
          title: 'Challenge Won & Badge Unlocked! 🏆',
          message: `You earned the '${progress.challenge.badgeTier}' badge for completing ${progress.challenge.title}!`,
          type: 'challenge',
          link: '/challenges.html',
        });
      }
    }

    await progress.save();

    res.status(200).json({
      success: true,
      message: progress.status === 'completed'
        ? `Incredible job! You completed the ${progress.challenge.title} challenge and earned your badge!`
        : `Check-in recorded! Streak: ${progress.currentStreak} day${progress.currentStreak === 1 ? '' : 's'}.`,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
};
