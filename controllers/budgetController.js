const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

// @desc    Get current month's budget with real spend comparisons
// @route   GET /api/budgets/current
exports.getCurrentBudget = async (req, res, next) => {
  try {
    const now = new Date();
    const currentMonthStr = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let budget = await Budget.findOne({ user: req.user.id, month: currentMonthStr });

    // Calculate actual spending in this month
    const [year, month] = currentMonthStr.split('-');
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const expensesAgg = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$category',
          spent: { $sum: '$amount' },
        },
      },
    ]);

    const spentByCategory = {};
    let totalSpent = 0;
    expensesAgg.forEach((item) => {
      spentByCategory[item._id] = item.spent;
      totalSpent += item.spent;
    });

    const categoryBudgetsWithUsage = [];
    if (budget && budget.categoryBudgets) {
      budget.categoryBudgets.forEach((cb) => {
        const spent = spentByCategory[cb.category] || 0;
        categoryBudgetsWithUsage.push({
          category: cb.category,
          limit: cb.limit,
          spent,
          remaining: Math.max(0, cb.limit - spent),
          percentage: cb.limit > 0 ? Math.min(100, Math.round((spent / cb.limit) * 100)) : 0,
          isOverBudget: spent > cb.limit,
        });
      });
    }

    const overallLimit = budget ? budget.overallLimit : 0;
    const remainingOverall = Math.max(0, overallLimit - totalSpent);
    const overallPercentage = overallLimit > 0 ? Math.min(100, Math.round((totalSpent / overallLimit) * 100)) : 0;

    res.status(200).json({
      success: true,
      data: {
        budget,
        month: currentMonthStr,
        overallLimit,
        totalSpent,
        remainingOverall,
        overallPercentage,
        isOverBudget: overallLimit > 0 && totalSpent > overallLimit,
        categoryBudgets: categoryBudgetsWithUsage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all budgets for user
// @route   GET /api/budgets
exports.getAllBudgets = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ user: req.user.id }).sort('-month');
    res.status(200).json({ success: true, count: budgets.length, data: budgets });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update budget
// @route   POST /api/budgets
exports.saveBudget = async (req, res, next) => {
  try {
    const { month, overallLimit, categoryBudgets } = req.body;

    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!overallLimit || parseFloat(overallLimit) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid overall budget limit.',
      });
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.user.id, month: targetMonth },
      {
        user: req.user.id,
        month: targetMonth,
        overallLimit: parseFloat(overallLimit),
        categoryBudgets: categoryBudgets || [],
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Budget saved successfully!',
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
exports.deleteBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Budget not found.' });
    }

    res.status(200).json({ success: true, message: 'Budget deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
