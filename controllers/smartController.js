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

    // 1. All-time aggregate for total balance
    const allTotals = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let lifetimeIncome = 0;
    let lifetimeExpenses = 0;
    allTotals.forEach((t) => {
      if (t._id === 'income') lifetimeIncome = t.total;
      if (t._id === 'expense') lifetimeExpenses = t.total;
    });

    const availableBalance = Math.max(0, lifetimeIncome - lifetimeExpenses);

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

    // 3. Total Savings (All savings goal contributions)
    const goals = await SavingsGoal.find({ user: userId });
    const totalSavings = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

    // 4. Budget progress
    const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
    const overallBudget = budget ? budget.overallLimit : 0;
    const remainingBudget = Math.max(0, overallBudget - monthExpenses);
    const budgetUsagePercent = overallBudget > 0 ? Math.min(100, Math.round((monthExpenses / overallBudget) * 100)) : 0;

    // 5. Daily Spending Limit
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

    // Today's spending
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

    const baseBudgetPool = overallBudget > 0 ? remainingBudget : Math.max(0, monthIncome - monthExpenses);
    const dailySpendingLimit = Math.round(baseBudgetPool / remainingDays);
    const remainingDailyAllowance = Math.max(0, dailySpendingLimit - todaySpent);

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
          availableBalance,
          totalIncome: monthIncome,
          totalExpenses: monthExpenses,
          totalSavings,
        },
        budget: {
          overallLimit: overallBudget,
          spent: monthExpenses,
          remaining: remainingBudget,
          usagePercentage: budgetUsagePercent,
          month: currentMonthStr,
        },
        dailyLimit: {
          limit: dailySpendingLimit,
          spentToday: todaySpent,
          remainingToday: remainingDailyAllowance,
          remainingDays,
          isExceeded: todaySpent > dailySpendingLimit && dailySpendingLimit > 0,
        },
        needsVsWants: {
          needsAmount,
          wantsAmount,
          totalExpenses: monthExpenses,
          needsPercentage: monthExpenses > 0 ? Math.round((needsAmount / monthExpenses) * 100) : 0,
          wantsPercentage: monthExpenses > 0 ? Math.round((wantsAmount / monthExpenses) * 100) : 0,
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

    // Upcoming essential expenses in remainder of month
    const upcomingReminders = await Reminder.find({
      user: userId,
      dueDate: { $gte: now, $lte: endOfMonth },
      isPaid: false,
    });
    const upcomingEssentialBills = upcomingReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

    const overallLimit = budget ? budget.overallLimit : 0;
    const remainingMonthBudget = Math.max(0, overallLimit - monthSpent);

    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

    // Net budget available for daily discretionary spend = remaining budget - upcoming committed bills
    const discretionaryPool = Math.max(0, remainingMonthBudget - upcomingEssentialBills);
    const dailyLimit = Math.round(discretionaryPool / remainingDays);

    // Today's actual spend
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

    res.status(200).json({
      success: true,
      data: {
        dailyLimit,
        spentToday,
        remainingToday: Math.max(0, dailyLimit - spentToday),
        remainingDays,
        upcomingEssentialBills,
        remainingMonthBudget,
        overallMonthBudget: overallLimit,
        isOverLimit: spentToday > dailyLimit && dailyLimit > 0,
        warning: spentToday > dailyLimit && dailyLimit > 0
          ? `You have spent ₹${spentToday.toLocaleString()} today, exceeding your daily limit by ₹${(spentToday - dailyLimit).toLocaleString()}.`
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
