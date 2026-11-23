const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Reminder = require('../models/Reminder');
const { calculateHealthScore } = require('./healthScoreService');

/**
 * SpendSmart Assistant Recommendation Engine
 * Analyzes real MongoDB financial records to deliver grounded student fintech advice.
 *
 * All monetary calculations use the same formula as the dashboard:
 *   Money Left = Opening Balance + Month Income − Month Expenses
 *   Safe Daily Amount = (Remaining Budget − Upcoming Bills) / Remaining Days
 */
async function getAssistantInsights(userId, customQuery = '') {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Fetch current month transactions
  const monthTransactions = await Transaction.find({
    user: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  }).sort({ date: -1 });

  let totalIncome = 0;
  let totalExpenses = 0;
  let needsExpenses = 0;
  let wantsExpenses = 0;
  const categoryTotals = {};

  monthTransactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      if (tx.classification === 'need') {
        needsExpenses += tx.amount;
      } else {
        wantsExpenses += tx.amount;
      }
    }
  });

  // 2. Opening balance = net of all transactions BEFORE this month
  //    (consistent with dashboard Money Left formula — rule 1)
  const priorTotals = await Transaction.aggregate([
    { $match: { user: userId, date: { $lt: startOfMonth } } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  let priorIncome = 0;
  let priorExpenses = 0;
  priorTotals.forEach((t) => {
    if (t._id === 'income') priorIncome = t.total;
    if (t._id === 'expense') priorExpenses = t.total;
  });
  const openingBalance = priorIncome - priorExpenses;

  // Money Left = Opening Balance + Month Income − Month Expenses
  const moneyLeft = openingBalance + totalIncome - totalExpenses;
  // Floor at 0 only for display/affordability checks; keep raw for logic
  const availableBalance = Math.max(0, moneyLeft);

  // Top spending category
  let topCategory = 'None';
  let topCategoryAmount = 0;
  Object.keys(categoryTotals).forEach((cat) => {
    if (categoryTotals[cat] > topCategoryAmount) {
      topCategoryAmount = categoryTotals[cat];
      topCategory = cat;
    }
  });

  // 3. Budget
  const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
  const overallLimit = budget ? budget.overallLimit : 0;
  const hasBudget = overallLimit > 0;
  // Budget remaining (raw; can be negative if overspent)
  const budgetRemaining = hasBudget ? overallLimit - totalExpenses : null;
  const remainingBudget = hasBudget ? Math.max(0, budgetRemaining) : 0;

  // 4. Reminders & Upcoming bills
  const upcomingReminders = await Reminder.find({
    user: userId,
    dueDate: { $gte: now, $lte: endOfMonth },
    isPaid: false,
  });
  const upcomingBillsTotal = upcomingReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

  // 5. Savings Goals
  const goals = await SavingsGoal.find({ user: userId, isCompleted: false });
  const totalGoalSavings = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

  // 6. Daily & Weekly Safe Allowance
  //    Safe Daily = (Remaining Budget − Upcoming Bills) / Remaining Days   (rule 5)
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

  // If budget set → use remaining budget; otherwise use money left (consistent with smartController)
  let discretionaryPool;
  if (hasBudget) {
    discretionaryPool = Math.max(0, (budgetRemaining || 0) - upcomingBillsTotal);
  } else {
    discretionaryPool = Math.max(0, moneyLeft - upcomingBillsTotal);
  }
  const dailySpendingLimit = Math.round(discretionaryPool / remainingDays);
  const weeklySpendingLimit = Math.round(dailySpendingLimit * 7);

  // Health Score
  const healthData = await calculateHealthScore(userId);

  // Top proactive recommendations for student
  const proactiveRecommendations = [];

  if (topCategoryAmount > 0) {
    const topCatPct = totalExpenses > 0 ? Math.round((topCategoryAmount / totalExpenses) * 100) : 0;
    proactiveRecommendations.push({
      topic: 'Top Expense Category',
      title: `${topCategory} takes ${topCatPct}% of your spend`,
      message: `You spent ₹${topCategoryAmount.toLocaleString('en-IN')} on ${topCategory} this month. Setting a weekly cap of ₹${Math.round(topCategoryAmount / 4).toLocaleString('en-IN')} can help you save ~₹${Math.round(topCategoryAmount * 0.2).toLocaleString('en-IN')} more.`,
      action: 'Set Category Budget',
    });
  }

  if (wantsExpenses > totalExpenses * 0.4 && totalExpenses > 0) {
    proactiveRecommendations.push({
      topic: 'Needs vs Wants Balance',
      title: 'Discretionary Wants are high',
      message: `Non-essential wants (Shopping, Entertainment, Cafes) make up ${Math.round((wantsExpenses / totalExpenses) * 100)}% of your expenses. Aim for 30% or less to build a reliable student emergency fund.`,
      action: 'Review Wants',
    });
  }

  if (upcomingBillsTotal > 0) {
    proactiveRecommendations.push({
      topic: 'Upcoming Obligations',
      title: `₹${upcomingBillsTotal.toLocaleString('en-IN')} due before month end`,
      message: `You have ${upcomingReminders.length} upcoming bill${upcomingReminders.length > 1 ? 's' : ''} or subscriptions due soon. Keep ₹${upcomingBillsTotal.toLocaleString('en-IN')} untouched in your account.`,
      action: 'View Calendar',
    });
  }

  if (dailySpendingLimit > 0) {
    proactiveRecommendations.push({
      topic: 'Daily Spending Guardrail',
      title: `Safe daily limit: ₹${dailySpendingLimit.toLocaleString('en-IN')}/day`,
      message: `With ${remainingDays} days left in the month, keeping your daily spending at or below ₹${dailySpendingLimit.toLocaleString('en-IN')} ensures you will finish the month with a surplus.`,
      action: 'Track Expenses',
    });
  }

  // Answer custom query if provided
  let answer = null;
  if (customQuery && customQuery.trim().length > 0) {
    const q = customQuery.toLowerCase();

    const affordMatch =
      q.match(/afford.*?(\d+[\d,]*)/i) ||
      q.match(/(\d+[\d,]*).*?afford/i) ||
      q.match(/buy.*?(\d+[\d,]*)/i);

    if (affordMatch) {
      const amt = parseFloat(affordMatch[1].replace(/,/g, ''));
      if (amt > availableBalance) {
        answer = {
          query: customQuery,
          status: 'danger',
          reply: `Based on your current money left (₹${moneyLeft.toLocaleString('en-IN')}), you cannot afford this ₹${amt.toLocaleString('en-IN')} purchase without going into deficit. We recommend waiting until your next allowance.`,
        };
      } else if (amt > discretionaryPool) {
        answer = {
          query: customQuery,
          status: 'warning',
          reply: `You have ₹${moneyLeft.toLocaleString('en-IN')} available, but after accounting for ₹${upcomingBillsTotal.toLocaleString('en-IN')} in upcoming bills, your safe discretionary cushion is ₹${discretionaryPool.toLocaleString('en-IN')}. Spending ₹${amt.toLocaleString('en-IN')} would stretch your budget uncomfortably. Consider waiting 7–14 days.`,
        };
      } else {
        answer = {
          query: customQuery,
          status: 'success',
          reply: `Yes, you can comfortably afford this purchase of ₹${amt.toLocaleString('en-IN')}! You will still have approximately ₹${(moneyLeft - amt).toLocaleString('en-IN')} remaining to cover upcoming commitments and daily needs.`,
        };
      }
    } else if (
      q.includes('how much should i save') ||
      q.includes('how much to save') ||
      q.includes('save this month')
    ) {
      const targetSavings = Math.round(totalIncome * 0.2);
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Using the student 50/30/20 rule, you should aim to save 20% of your income. On your current monthly income of ₹${totalIncome.toLocaleString('en-IN')}, your target monthly savings is ₹${targetSavings.toLocaleString('en-IN')}. You have currently retained ₹${Math.max(0, totalIncome - totalExpenses).toLocaleString('en-IN')} of this month's income.`,
      };
    } else if (
      q.includes('which category') ||
      q.includes('most of my money') ||
      q.includes('top category') ||
      q.includes('highest spend')
    ) {
      answer = {
        query: customQuery,
        status: 'info',
        reply:
          topCategoryAmount > 0
            ? `Your biggest spending category this month is **${topCategory}**, totaling ₹${topCategoryAmount.toLocaleString('en-IN')} (${totalExpenses > 0 ? Math.round((topCategoryAmount / totalExpenses) * 100) : 0}% of all your expenses).`
            : "You haven't logged any expenses yet this month!",
      };
    } else if (
      q.includes('reduce') ||
      q.includes('cut') ||
      q.includes('how can i reduce')
    ) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Here are 3 high-impact ways to reduce expenses this month:\n1. Non-essential 'Wants' like takeout and impulsive shopping currently cost you ₹${wantsExpenses.toLocaleString('en-IN')}. Packing snacks or eating at the hostel mess can save ₹1,000–₹1,500.\n2. Review your subscription reminders in the Financial Calendar to cancel services you rarely use.\n3. Join the 'No-Spend Weekend' or 'Save ₹500 This Week' challenges in SpendSmart to build streak discipline.`,
      };
    } else if (
      q.includes('spend this week') ||
      q.includes('weekly limit') ||
      q.includes('this week')
    ) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your safe spending limit for this week is **₹${weeklySpendingLimit.toLocaleString('en-IN')}** (approx. ₹${dailySpendingLimit.toLocaleString('en-IN')} per day). Staying within this limit will keep you safely within your monthly budget.`,
      };
    } else if (
      q.includes('daily limit') ||
      q.includes('how much can i spend today') ||
      q.includes('today')
    ) {
      const poolDesc = hasBudget
        ? `remaining budget of ₹${remainingBudget.toLocaleString('en-IN')} minus ₹${upcomingBillsTotal.toLocaleString('en-IN')} in upcoming bills`
        : `available balance of ₹${availableBalance.toLocaleString('en-IN')} minus ₹${upcomingBillsTotal.toLocaleString('en-IN')} in upcoming bills`;
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your safe spending limit for today is **₹${dailySpendingLimit.toLocaleString('en-IN')}**. (Calculated from ${poolDesc}, divided by ${remainingDays} days left in the month.)`,
      };
    } else if (q.includes('health') || q.includes('score')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your current Financial Health Score is **${healthData.score}/100** (${healthData.category}). ${healthData.scoreBreakdownText || ''}. ${healthData.suggestions[0] || 'Keep logging daily transactions to maintain your financial health!'}`,
      };
    } else {
      // General financial advisor response
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Based on your records: Your money left this month is ₹${moneyLeft.toLocaleString('en-IN')} (opening ₹${openingBalance.toLocaleString('en-IN')} + income ₹${totalIncome.toLocaleString('en-IN')} − expenses ₹${totalExpenses.toLocaleString('en-IN')}). Your safe daily spending limit is ₹${dailySpendingLimit.toLocaleString('en-IN')}/day across the next ${remainingDays} days. To stay financially secure, keep your non-essential wants below 30% of your expenses and fund your emergency savings goal.`,
      };
    }
  }

  return {
    overview: {
      moneyLeft,
      availableBalance,
      openingBalance,
      totalIncome,
      totalExpenses,
      remainingBudget,
      hasBudget,
      dailySpendingLimit,
      weeklySpendingLimit,
      remainingDays,
      topCategory,
      topCategoryAmount,
      wantsExpenses,
      needsExpenses,
      upcomingBillsTotal,
      healthScore: healthData.score,
      healthCategory: healthData.category,
    },
    recommendations: proactiveRecommendations,
    answer,
    engineInfo: {
      engine: 'SpendSmart Rule-Based Financial Logic v2.0',
      note: 'Uses Money Left = Opening Balance + Month Income − Month Expenses. Daily limit accounts for upcoming committed bills. Consistent formula across dashboard, assistant and purchase checker.',
    },
  };
}

module.exports = { getAssistantInsights };
