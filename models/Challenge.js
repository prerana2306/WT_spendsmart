const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['No-Spend', 'Saving Amount', 'Streak', 'Category Restriction', 'Milestone'],
      default: 'No-Spend',
    },
    durationDays: {
      type: Number,
      required: true,
      default: 7,
    },
    targetAmount: {
      type: Number,
      default: 0,
    },
    targetCategory: {
      type: String,
      default: '',
    },
    badgeTier: {
      type: String,
      enum: ['Bronze Saver', 'Silver Saver', 'Gold Saver', 'Money Master'],
      default: 'Bronze Saver',
    },
    icon: {
      type: String,
      default: 'award',
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Challenge', ChallengeSchema);
