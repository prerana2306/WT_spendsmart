const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Reminder = require('../models/Reminder');
const ChallengeProgress = require('../models/ChallengeProgress');
const { calculateHealthScore } = require('../services/healthScoreService');
const { detectAnomalies } = require('../services/anomalyService');
const { evaluatePurchase } = require('../services/purchaseService');
const { runSimulation } = require('../services/simulationService');
const { getAssistantInsights } = require('../services/assistantService');

// @desc    Dashboard Comprehensive Financial Overview
// @route   GET /api/smart/overview
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Opening Balance = net of ALL transactions BEFORE this month
    //    Rule: Money Left = Opening Balance + This Month Income − This Month Expenses
    const priorTotals = await Transaction.aggregate([
      { $match: { user: userId, date: { $lt: startOfMonth } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let priorIncome = 0;
    let priorExpenses = 0;
    priorTotals.forEach((t) => {
      if (t._id === 'income') priorIncome = t.total;
      if (t._id === 'expense') priorExpenses = t.total;
    });
    // Opening balance is the net carried forward into this month (can be negative if overspent historically)
    const openingBalance = priorIncome - priorExpenses;

    // 2. Current Month Totals
    const monthTotals = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let monthIncome = 0;
    let monthExpenses = 0;
    monthTotals.forEach((t) => {
      if (t._id === 'income') monthIncome = t.total;
      if (t._id === 'expense') monthExpenses = t.total;
    });

    // Money Left = Opening Balance + This Month Income − This Month Expenses
    // This is the actual spendable balance; we do NOT floor at 0 — a negative means overspent.
    const moneyLeft = openingBalance + monthIncome - monthExpenses;

    // 3. Total Savings (All savings goal contributions)
    //    Savings goal contributions are tracked SEPARATELY in SavingsGoal.currentAmount.
    //    They are NOT deducted again from moneyLeft here to avoid double-counting.
    const goals = await SavingsGoal.find({ user: userId });
    const totalSavings = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

    // 4. Budget progress
    //    Budget Used % = (Month Expenses / Monthly Budget) × 100
    //    Budget Remaining = Monthly Budget − Month Expenses
    const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
    const overallBudget = budget ? budget.overallLimit : 0;
    const hasBudget = overallBudget > 0;

    // Budget remaining can be negative (overspent); expose the raw value for display logic
    const budgetRemaining = hasBudget ? overallBudget - monthExpenses : null;
    const budgetRemainingDisplay = hasBudget ? Math.max(0, budgetRemaining) : 0;
    const budgetUsagePercent = hasBudget
      ? Math.min(100, Math.round((monthExpenses / overallBudget) * 100))
      : null; // null = no budget set; display "—" on the frontend

    // 5. Daily Spending Limit
    //    Safe Daily Amount = (Remaining Spendable Budget − Upcoming Committed Expenses) / Remaining Days
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

    // Upcoming committed expenses (unpaid reminders before month-end)
    const upcomingRemindersForDaily = await Reminder.find({
      user: userId,
      dueDate: { $gte: now, $lte: endOfMonth },
      isPaid: false,
    });
    const upcomingCommittedAmount = upcomingRemindersForDaily.reduce(
      (acc, r) => acc + (r.amount || 0),
      0
    );

    // Pool for daily discretionary spending:
    // If a budget is set → use remaining budget (capped at 0) minus committed bills
    // If no budget set → use remaining money left minus committed bills
    let discretionaryPool;
    if (hasBudget) {
      discretionaryPool = Math.max(0, budgetRemaining - upcomingCommittedAmount);
    } else {
      // No budget: base pool on money left minus committed bills
      discretionaryPool = Math.max(0, moneyLeft - upcomingCommittedAmount);
    }
    const dailySpendingLimit = remainingDays > 0 ? Math.round(discretionaryPool / remainingDays) : 0;

    // Today's spending
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const todaySpendAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const todaySpent = todaySpendAgg.length > 0 ? todaySpendAgg[0].total : 0;

    // Remaining Today = Today's Spending Allowance − Today's Expenses
    // Can be negative (over limit for today); we expose the raw value.
    const remainingTodayRaw = dailySpendingLimit - todaySpent;
    const remainingTodayDisplay = Math.max(0, remainingTodayRaw);

    // 6. Upcoming bill reminders
    const upcomingBills = await Reminder.find({
      user: userId,
      dueDate: { $gte: now },
      isPaid: false,
    })
      .sort('dueDate')
      .limit(5);

    // 7. Recent transactions
    const recentTransactions = await Transaction.find({ user: userId })
      .sort('-date')
      .limit(6);

    // 8. Active challenges
    const activeChallenges = await ChallengeProgress.find({ user: userId, status: 'active' })
      .populate('challenge')
      .limit(3);

    // 9. Financial Health Score
    const healthData = await calculateHealthScore(userId);

    // 10. Needs vs Wants current breakdown
    const needsWantsAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$classification',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let needsAmount = 0;
    let wantsAmount = 0;
    needsWantsAgg.forEach((item) => {
      if (item._id === 'need') needsAmount = item.total;
      if (item._id === 'want') wantsAmount = item.total;
    });

    res.status(200).json({
      success: true,
      data: {
        summaryCards: {
          // moneyLeft is the accurate "Money Left" value
          // = Opening Balance + Month Income − Month Expenses
          moneyLeft,
          // For backward compatibility, also expose as availableBalance
          // but it now uses the CORRECT formula (not lifetime totals)
          availableBalance: moneyLeft,
          totalIncome: monthIncome,
          totalExpenses: monthExpenses,
          totalSavings,
          openingBalance,
          // Metadata flags for UI conditional rendering
          hasTransactions: monthIncome > 0 || monthExpenses > 0,
        },
        budget: {
          overallLimit: overallBudget,
          spent: monthExpenses,
          // Expose raw remaining (may be negative for overspend detection)
          remaining: budgetRemainingDisplay,
          remainingRaw: budgetRemaining,
          // null means no budget is set; frontend should show "No budget set"
          usagePercentage: budgetUsagePercent,
          hasBudget,
          month: currentMonthStr,
          isOverBudget: hasBudget && monthExpenses > overallBudget,
        },
        dailyLimit: {
          limit: dailySpendingLimit,
          spentToday: todaySpent,
          remainingToday: remainingTodayDisplay,
          remainingTodayRaw,
          remainingDays,
          upcomingCommittedAmount,
          discretionaryPool,
          isExceeded: todaySpent > dailySpendingLimit && dailySpendingLimit > 0,
          hasDailyLimit: dailySpendingLimit > 0,
        },
        needsVsWants: {
          needsAmount,
          wantsAmount,
          totalExpenses: monthExpenses,
          needsPercentage:
            monthExpenses > 0 ? Math.round((needsAmount / monthExpenses) * 100) : 0,
          wantsPercentage:
            monthExpenses > 0 ? Math.round((wantsAmount / monthExpenses) * 100) : 0,
        },
        healthScore: healthData,
        recentTransactions,
        upcomingBills,
        activeChallenges,
        goals: goals.slice(0, 4),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Smart Money Assistant
// @route   GET /api/smart/assistant
exports.getAssistant = async (req, res, next) => {
  try {
    const data = await getAssistantInsights(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Ask Assistant Query
// @route   POST /api/smart/assistant/query
exports.askAssistantQuery = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a question.' });
    }
    const data = await getAssistantInsights(req.user.id, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Smart Purchase Decision Check
// @route   POST /api/smart/purchase-check
exports.checkPurchaseDecision = async (req, res, next) => {
  try {
    const { productName, amount, category } = req.body;
    const evaluation = await evaluatePurchase(req.user.id, { productName, amount, category });
    res.status(200).json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

// @desc    Needs vs Wants Breakdown & Historical Trends
// @route   GET /api/smart/needs-wants
exports.getNeedsVsWants = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Current month by classification
    const classificationAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$classification',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let needsTotal = 0;
    let wantsTotal = 0;
    classificationAgg.forEach((item) => {
      if (item._id === 'need') needsTotal = item.total;
      if (item._id === 'want') wantsTotal = item.total;
    });

    const totalSpend = needsTotal + wantsTotal;
    const needsPct = totalSpend > 0 ? Math.round((needsTotal / totalSpend) * 100) : 50;
    const wantsPct = totalSpend > 0 ? Math.round((wantsTotal / totalSpend) * 100) : 50;

    // Category breakdown with classification
    const categoryAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: { category: '$category', classification: '$classification' },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Monthly 6-month trend for needs vs wants
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyTrendsAgg = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: sixMonthsAgo, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            classification: '$classification',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const recommendations = [];
    if (wantsPct > 40) {
      recommendations.push({
        title: 'High Non-Essential Spending',
        description: `Your 'Wants' represent ${wantsPct}% of your spending this month. Try applying the 48-hour rule on impulse shopping to keep it under 30%.`,
      });
    } else {
      recommendations.push({
        title: 'Healthy Spending Balance',
        description: `Excellent discipline! You are allocating ${needsPct}% of your spending towards essential needs.`,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        currentMonth: {
          needsTotal,
          wantsTotal,
          totalSpend,
          needsPercentage: needsPct,
          wantsPercentage: wantsPct,
        },
        categoryBreakdown: categoryAgg.map((item) => ({
          category: item._id.category,
          classification: item._id.classification,
          amount: item.total,
        })),
        monthlyTrends: monthlyTrendsAgg,
        recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Expense Anomaly Detection
// @route   GET /api/smart/anomalies
exports.getAnomalies = async (req, res, next) => {
  try {
    const result = await detectAnomalies(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Financial Health Score
// @route   GET /api/smart/health-score
exports.getHealthScore = async (req, res, next) => {
  try {
    const health = await calculateHealthScore(req.user.id);
    res.status(200).json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
};

// @desc    What-If Savings Simulator
// @route   POST /api/smart/simulate
exports.simulateSavings = async (req, res, next) => {
  try {
    const result = runSimulation(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Smart Daily Spending Limit
// @route   GET /api/smart/daily-limit
exports.getDailySpendingLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const budget = await Budget.findOne({ user: userId, month: currentMonthStr });

    // Current month expenses
    const monthExpensesAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const monthSpent = monthExpensesAgg.length > 0 ? monthExpensesAgg[0].total : 0;

    // Current month income
    const monthIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'income',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const monthIncome = monthIncomeAgg.length > 0 ? monthIncomeAgg[0].total : 0;

    // Opening balance (prior months' net)
    const priorTotals = await Transaction.aggregate([
      { $match: { user: req.user._id, date: { $lt: startOfMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    let priorIncome = 0;
    let priorExpenses = 0;
    priorTotals.forEach((t) => {
      if (t._id === 'income') priorIncome = t.total;
      if (t._id === 'expense') priorExpenses = t.total;
    });
    const openingBalance = priorIncome - priorExpenses;
    const moneyLeft = openingBalance + monthIncome - monthSpent;

    // Upcoming essential expenses in remainder of month
    const upcomingReminders = await Reminder.find({
      user: userId,
      dueDate: { $gte: now, $lte: endOfMonth },
      isPaid: false,
    });
    const upcomingEssentialBills = upcomingReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

    const overallLimit = budget ? budget.overallLimit : 0;
    const hasBudget = overallLimit > 0;

    // Budget remaining for the month (raw, before deducting committed bills)
    const remainingMonthBudget = hasBudget ? overallLimit - monthSpent : null;

    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

    // Net budget available for daily discretionary spend = remaining budget - upcoming committed bills
    // If no budget set, fall back to money left minus upcoming bills
    let discretionaryPool;
    if (hasBudget) {
      discretionaryPool = Math.max(0, remainingMonthBudget - upcomingEssentialBills);
    } else {
      discretionaryPool = Math.max(0, moneyLeft - upcomingEssentialBills);
    }
    const dailyLimit = remainingDays > 0 ? Math.round(discretionaryPool / remainingDays) : 0;

    // Today's actual spend
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const todaySpendAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const spentToday = todaySpendAgg.length > 0 ? todaySpendAgg[0].total : 0;

    // Remaining Today = Today's Allowance − Today's Expenses (raw value, can be negative)
    const remainingTodayRaw = dailyLimit - spentToday;

    res.status(200).json({
      success: true,
      data: {
        dailyLimit,
        spentToday,
        remainingToday: Math.max(0, remainingTodayRaw),
        remainingTodayRaw,
        remainingDays,
        upcomingEssentialBills,
        discretionaryPool,
        remainingMonthBudget: remainingMonthBudget !== null ? Math.max(0, remainingMonthBudget) : null,
        overallMonthBudget: overallLimit,
        hasBudget,
        isOverLimit: spentToday > dailyLimit && dailyLimit > 0,
        warning:
          spentToday > dailyLimit && dailyLimit > 0
            ? `You have spent ₹${spentToday.toLocaleString('en-IN')} today, exceeding your daily limit by ₹${(spentToday - dailyLimit).toLocaleString('en-IN')}.`
            : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
