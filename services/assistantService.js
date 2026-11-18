const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Reminder = require('../models/Reminder');
const { calculateHealthScore } = require('./healthScoreService');

/**
 * SpendSmart Assistant Recommendation Engine
 * Analyzes real MongoDB financial records to deliver grounded student fintech advice.
 */
async function getAssistantInsights(userId, customQuery = '') {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Fetch transactions
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

  const availableBalance = Math.max(0, totalIncome - totalExpenses);

  // Top spending category
  let topCategory = 'None';
  let topCategoryAmount = 0;
  Object.keys(categoryTotals).forEach((cat) => {
    if (categoryTotals[cat] > topCategoryAmount) {
      topCategoryAmount = categoryTotals[cat];
      topCategory = cat;
    }
  });

  // 2. Budget
  const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
  const overallLimit = budget ? budget.overallLimit : totalIncome * 0.8;
  const remainingBudget = Math.max(0, overallLimit - totalExpenses);

  // 3. Reminders & Upcoming bills
  const upcomingReminders = await Reminder.find({
    user: userId,
    dueDate: { $gte: now, $lte: endOfMonth },
    isPaid: false,
  });
  const upcomingBillsTotal = upcomingReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

  // 4. Savings Goals
  const goals = await SavingsGoal.find({ user: userId, isCompleted: false });
  const totalGoalSavings = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

  // 5. Daily & Weekly Safe Allowance
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

  const safePool = Math.max(0, (budget ? remainingBudget : availableBalance) - upcomingBillsTotal);
  const dailySpendingLimit = Math.round(safePool / remainingDays);
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
      message: `You spent ₹${topCategoryAmount.toLocaleString()} on ${topCategory} this month. Setting a weekly cap of ₹${Math.round(topCategoryAmount / 4)} can help you save ~₹${Math.round(topCategoryAmount * 0.2)} more.`,
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
      title: `₹${upcomingBillsTotal.toLocaleString()} due before month end`,
      message: `You have ${upcomingReminders.length} upcoming bill${upcomingReminders.length > 1 ? 's' : ''} or subscriptions due soon. Keep ₹${upcomingBillsTotal.toLocaleString()} untouched in your account.`,
      action: 'View Calendar',
    });
  }

  if (dailySpendingLimit > 0) {
    proactiveRecommendations.push({
      topic: 'Daily Spending Guardrail',
      title: `Safe daily limit: ₹${dailySpendingLimit.toLocaleString()}/day`,
      message: `With ${remainingDays} days left in the month, keeping your daily spending at or below ₹${dailySpendingLimit.toLocaleString()} ensures you will finish the month with a surplus.`,
      action: 'Track Expenses',
    });
  }

  // Answer custom query if provided
  let answer = null;
  if (customQuery && customQuery.trim().length > 0) {
    const q = customQuery.toLowerCase();

    // Check for "Can I afford ₹X" or "afford X"
    const affordMatch = q.match(/afford.*?(\d+[\d,]*)/i) || q.match(/(\d+[\d,]*).*?afford/i) || q.match(/buy.*?(\d+[\d,]*)/i);
    if (affordMatch) {
      const amt = parseFloat(affordMatch[1].replace(/,/g, ''));
      if (amt > availableBalance) {
        answer = {
          query: customQuery,
          status: 'danger',
          reply: `Based on your live account balance of ₹${availableBalance.toLocaleString()}, you cannot currently afford this ₹${amt.toLocaleString()} purchase without overdrafting. We recommend waiting until your next allowance.`,
        };
      } else if (amt > safePool) {
        answer = {
          query: customQuery,
          status: 'warning',
          reply: `You have ₹${availableBalance.toLocaleString()} in your account, but after accounting for ₹${upcomingBillsTotal.toLocaleString()} in upcoming bills and safety buffer, you only have ₹${safePool.toLocaleString()} in safe discretionary cushion. Spending ₹${amt.toLocaleString()} would stretch your budget uncomfortably. Consider waiting 7-14 days.`,
        };
      } else {
        answer = {
          query: customQuery,
          status: 'success',
          reply: `Yes, you can comfortably afford this purchase of ₹${amt.toLocaleString()}! You will still have approximately ₹${(availableBalance - amt).toLocaleString()} remaining to cover upcoming commitments and daily needs.`,
        };
      }
    } else if (q.includes('how much should i save') || q.includes('how much to save') || q.includes('save this month')) {
      const targetSavings = Math.round(totalIncome * 0.2);
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Using the student 50/30/20 rule, you should aim to save 20% of your income. On your current monthly income of ₹${totalIncome.toLocaleString()}, your target monthly savings is ₹${targetSavings.toLocaleString()}. You have currently saved ₹${Math.max(0, totalIncome - totalExpenses).toLocaleString()}.`,
      };
    } else if (q.includes('which category') || q.includes('most of my money') || q.includes('top category') || q.includes('highest spend')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: topCategoryAmount > 0
          ? `Your biggest spending category this month is **${topCategory}**, totaling ₹${topCategoryAmount.toLocaleString()} (${totalExpenses > 0 ? Math.round((topCategoryAmount / totalExpenses) * 100) : 0}% of all your expenses).`
          : 'You haven\'t logged any expenses yet this month!',
      };
    } else if (q.includes('reduce') || q.includes('cut') || q.includes('how can i reduce')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Here are 3 high-impact ways to reduce expenses this month:\n1. Non-essential 'Wants' like takeout and impulsive shopping currently cost you ₹${wantsExpenses.toLocaleString()}. Packing snacks or eating at the hostel mess can save ₹1,000–₹1,500.\n2. Review your subscription reminders in the Financial Calendar to cancel services you rarely use.\n3. Join the 'No-Spend Weekend' or 'Save ₹500 This Week' challenges in SpendSmart to build streak discipline.`,
      };
    } else if (q.includes('spend this week') || q.includes('weekly limit') || q.includes('this week')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your safe spending limit for this week is **₹${weeklySpendingLimit.toLocaleString()}** (approx. ₹${dailySpendingLimit.toLocaleString()} per day). Staying within this limit will keep you safely within your monthly budget.`,
      };
    } else if (q.includes('daily limit') || q.includes('how much can i spend today') || q.includes('today')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your safe spending limit for today is **₹${dailySpendingLimit.toLocaleString()}**. (Calculated from remaining budget of ₹${remainingBudget.toLocaleString()} divided by ${remainingDays} days left in the month).`,
      };
    } else if (q.includes('health') || q.includes('score')) {
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Your current Financial Health Score is **${healthData.score}/100** (${healthData.category}). ${healthData.suggestions[0] || 'Keep logging daily transactions to maintain your financial health!'}`,
      };
    } else {
      // General financial advisor response
      answer = {
        query: customQuery,
        status: 'info',
        reply: `Based on your records: Your available balance is ₹${availableBalance.toLocaleString()}, monthly expenses are ₹${totalExpenses.toLocaleString()}, and your safe daily spending limit is ₹${dailySpendingLimit.toLocaleString()}/day across the next ${remainingDays} days. To stay financially secure, keep your non-essential wants below 30% of your expenses and fund your emergency savings goal.`,
      };
    }
  }

  return {
    overview: {
      availableBalance,
      totalIncome,
      totalExpenses,
      remainingBudget,
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
      engine: 'SpendSmart Rule-Based Financial Logic v1.0',
      note: 'Analyzes live MongoDB records and standard fintech budgeting heuristics (50/30/20, daily burn pacing). Fully extensible to OpenAI/Gemini API.',
    },
  };
}

module.exports = { getAssistantInsights };
