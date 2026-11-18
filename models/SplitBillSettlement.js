const mongoose = require('mongoose');

const SplitBillSettlementSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SplitBillGroup',
      required: true,
      index: true,
    },
    fromMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fromName: {
      type: String,
      required: true,
    },
    toMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    toName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than zero'],
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SplitBillSettlement', SplitBillSettlementSchema);
