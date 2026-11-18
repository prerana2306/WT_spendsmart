const mongoose = require('mongoose');

const NEED_CATEGORIES = ['Food', 'Transport', 'Education', 'Bills', 'Healthcare', 'Hostel'];

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
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
        'Salary',
        'Allowance',
        'Freelance',
        'Scholarship',
        'Gift',
        'Other',
      ],
      default: 'Food',
    },
    classification: {
      type: String,
      enum: ['need', 'want'],
      default: function () {
        if (this.type === 'income') return 'need';
        return NEED_CATEGORIES.includes(this.category) ? 'need' : 'want';
      },
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Other'],
      default: 'UPI',
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    receiptUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

TransactionSchema.index({ user: 1, date: -1 });
TransactionSchema.index({ user: 1, category: 1 });
TransactionSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
