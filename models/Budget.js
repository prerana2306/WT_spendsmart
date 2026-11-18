const mongoose = require('mongoose');

const CategoryBudgetSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        'Food',
        'Transport',
        'Shopping',
        'Education',
        'Entertainment',
        'Bills',
        'Healthcare',
        'Hostel',
        'Personal Care',
        'Other',
      ],
    },
    limit: {
      type: Number,
      required: true,
      min: [0, 'Limit cannot be negative'],
    },
  },
  { _id: false }
);

const BudgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String, // Format: YYYY-MM
      required: true,
      index: true,
    },
    overallLimit: {
      type: Number,
      required: [true, 'Overall monthly budget limit is required'],
      min: [0, 'Limit cannot be negative'],
    },
    categoryBudgets: [CategoryBudgetSchema],
  },
  {
    timestamps: true,
  }
);

BudgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
