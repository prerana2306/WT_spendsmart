const mongoose = require('mongoose');

const ContributionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [1, 'Contribution must be at least 1'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const SavingsGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Goal name is required'],
      trim: true,
      maxlength: [100, 'Goal name cannot exceed 100 characters'],
    },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [100, 'Target amount must be at least 100'],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deadline: {
      type: Date,
      required: [true, 'Target deadline is required'],
    },
    category: {
      type: String,
      enum: ['Tech & Gadgets', 'Education & Courses', 'Travel & Trips', 'Emergency Fund', 'Fashion & Personal', 'Vehicle', 'Other'],
      default: 'Emergency Fund',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    contributions: [ContributionSchema],
  },
  {
    timestamps: true,
  }
);

SavingsGoalSchema.virtual('progressPercentage').get(function () {
  if (!this.targetAmount || this.targetAmount === 0) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

SavingsGoalSchema.set('toJSON', { virtuals: true });
SavingsGoalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SavingsGoal', SavingsGoalSchema);
