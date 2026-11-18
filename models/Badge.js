const mongoose = require('mongoose');

const BadgeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    tier: {
      type: String,
      enum: ['Bronze Saver', 'Silver Saver', 'Gold Saver', 'Money Master'],
      default: 'Bronze Saver',
    },
    icon: {
      type: String,
      default: 'shield',
    },
    awardedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

BadgeSchema.index({ user: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Badge', BadgeSchema);
