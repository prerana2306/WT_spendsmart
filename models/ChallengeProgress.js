const mongoose = require('mongoose');

const CheckInSchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    completed: {
      type: Boolean,
      default: true,
    },
    savedAmount: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
    },
    checkedInAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ChallengeProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    checkIns: [CheckInSchema],
    currentStreak: {
      type: Number,
      default: 0,
    },
    isBadgeAwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ChallengeProgressSchema.index({ user: 1, challenge: 1, status: 1 });

module.exports = mongoose.model('ChallengeProgress', ChallengeProgressSchema);
