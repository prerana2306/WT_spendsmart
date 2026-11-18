const Transaction = require('../models/Transaction');

/**
 * Anomaly Detection Service
 * Detects statistical spending spikes and unusual patterns compared to historical averages.
 */
async function detectAnomalies(userId) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Check total transaction count
  const allExpenseCount = await Transaction.countDocuments({ user: userId, type: 'expense' });
  if (allExpenseCount < 4) {
    return {
      hasSufficientData: false,
      message: 'Keep logging expenses! SpendSmart needs at least 4-5 transactions across multiple weeks to establish your baseline spending pattern.',
      anomalies: [],
    };
  }

  // Current month expenses by category
  const currentMonthAgg = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: currentMonthStart, $lte: now },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        maxSingle: { $max: '$amount' },
      },
    },
  ]);

  // Prior period expenses by category (historical baseline)
  const priorMonthAgg = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: priorMonthStart, $lte: priorMonthEnd },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgPerTx: { $avg: '$amount' },
      },
    },
  ]);

  const priorMap = {};
  priorMonthAgg.forEach((item) => {
    priorMap[item._id] = item;
  });

  const anomalies = [];

  // Check 1: Category surge comparison
  currentMonthAgg.forEach((cat) => {
    const prior = priorMap[cat._id];
    if (prior && prior.total > 0) {
      const percentageChange = Math.round(((cat.total - prior.total) / prior.total) * 100);
      if (percentageChange >= 50 && cat.total - prior.total >= 300) {
        anomalies.push({
          type: 'category_surge',
          severity: percentageChange >= 100 ? 'high' : 'medium',
          category: cat._id,
          currentTotal: cat.total,
          historicalAverage: prior.total,
          percentageIncrease: percentageChange,
          title: `${cat._id} Spending Surge (+${percentageChange}%)`,
          message: `Your ${cat._id} expenses have increased by ${percentageChange}% (₹${cat.total.toLocaleString()} vs ₹${prior.total.toLocaleString()} last month).`,
          recommendation: `Check your recent ${cat._id} transactions to identify impulse purchases and set a category cap.`,
          detectedAt: now,
        });
      }
    }
  });

  // Check 2: Single outlier transaction detection (e.g. any single transaction > 60% of all monthly spend)
  const totalCurrentSpend = currentMonthAgg.reduce((acc, c) => acc + c.total, 0);
  if (totalCurrentSpend > 0) {
    currentMonthAgg.forEach((cat) => {
      if (cat.maxSingle >= 1500 && cat.maxSingle > totalCurrentSpend * 0.45) {
        anomalies.push({
          type: 'single_outlier',
          severity: 'medium',
          category: cat._id,
          amount: cat.maxSingle,
          title: `Large Single Expense in ${cat._id}`,
          message: `A single ${cat._id} transaction of ₹${cat.maxSingle.toLocaleString()} accounted for over 45% of your current monthly spending.`,
          recommendation: 'Evaluate if this was an emergency or planned purchase, and adjust your remaining budget accordingly.',
          detectedAt: now,
        });
      }
    });
  }

  return {
    hasSufficientData: true,
    totalAnomalies: anomalies.length,
    anomalies,
  };
}

module.exports = { detectAnomalies };
