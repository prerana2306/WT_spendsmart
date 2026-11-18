const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Reminder = require('../models/Reminder');
const SavingsGoal = require('../models/SavingsGoal');

/**
 * Smart Purchase Decision Calculator
 * Evaluates affordability using real-time user balances, upcoming obligations, and budget commitments.
 */
async function evaluatePurchase(userId, { productName, amount, category = 'Shopping' }) {
  const purchaseAmount = parseFloat(amount);
  if (!purchaseAmount || purchaseAmount <= 0) {
    throw new Error('Please enter a valid purchase amount greater than zero.');
  }

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Calculate real available balance (Lifetime or current month)
  const allTransactions = await Transaction.find({ user: userId });
  let totalIncome = 0;
  let totalExpenses = 0;
  let currentMonthExpenses = 0;

  allTransactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
      if (new Date(tx.date) >= startOfMonth && new Date(tx.date) <= endOfMonth) {
        currentMonthExpenses += tx.amount;
      }
    }
  });

  const availableBalance = Math.max(0, totalIncome - totalExpenses);

  // 2. Monthly Budget check
  const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
  const monthlyBudgetLimit = budget ? budget.overallLimit : 0;
  const remainingBudget = monthlyBudgetLimit > 0 ? Math.max(0, monthlyBudgetLimit - currentMonthExpenses) : null;

  // 3. Upcoming essential obligations (Unpaid reminders before month end)
  const upcomingReminders = await Reminder.find({
    user: userId,
    dueDate: { $gte: now, $lte: endOfMonth },
    isPaid: false,
  });
  const upcomingObligations = upcomingReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

  // 4. Committed Savings Goals
  const activeGoals = await SavingsGoal.find({ user: userId, isCompleted: false });
  const totalGoalTargets = activeGoals.reduce((acc, g) => acc + g.targetAmount, 0);

  // Discretionary Cushion = Available Balance - Upcoming Obligations - (Safety Buffer of 10% or ₹500)
  const safetyBuffer = Math.min(1000, Math.max(300, availableBalance * 0.1));
  const safeDisposableBuffer = availableBalance - upcomingObligations - safetyBuffer;

  const balanceAfterPurchase = availableBalance - purchaseAmount;
  const remainingBudgetAfter = remainingBudget !== null ? remainingBudget - purchaseAmount : null;

  // Decision Logic
  let decision = 'Not Recommended';
  let badgeClass = 'danger'; // danger, warning, success
  let explanation = '';
  let waitingPeriodDays = 0;
  let recommendation = '';

  if (purchaseAmount > availableBalance) {
    decision = 'Not Affordable';
    badgeClass = 'danger';
    explanation = `This purchase of ₹${purchaseAmount.toLocaleString()} exceeds your current available balance of ₹${availableBalance.toLocaleString()} by ₹${(purchaseAmount - availableBalance).toLocaleString()}. You would enter an overdraft/debt situation.`;
    waitingPeriodDays = 30;
    recommendation = 'Hold off until your next allowance or income cycle. Do not borrow money for non-essential purchases.';
  } else if (purchaseAmount > safeDisposableBuffer) {
    decision = 'Risky / Stretches Budget';
    badgeClass = 'warning';
    const shortfall = Math.round(purchaseAmount - safeDisposableBuffer);
    explanation = `You have ₹${availableBalance.toLocaleString()} in your account, but you have ₹${upcomingObligations.toLocaleString()} in upcoming bill commitments and a safety buffer of ₹${Math.round(safetyBuffer).toLocaleString()}. Making this purchase leaves only ₹${balanceAfterPurchase.toLocaleString()}, which risks leaving you short for essential needs.`;
    const daysLeftInMonth = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
    waitingPeriodDays = Math.min(daysLeftInMonth, Math.ceil(shortfall / 100));
    recommendation = `Consider the 72-Hour Rule: wait ${waitingPeriodDays} days to verify if this is an impulse want or a genuine need. If still needed, save ₹${Math.ceil(shortfall / waitingPeriodDays)}/day.`;
  } else if (remainingBudget !== null && purchaseAmount > remainingBudget) {
    decision = 'Exceeds Monthly Budget';
    badgeClass = 'warning';
    explanation = `You have sufficient cash balance, but this purchase exceeds your remaining monthly budget of ₹${remainingBudget.toLocaleString()} by ₹${Math.round(purchaseAmount - remainingBudget).toLocaleString()}.`;
    waitingPeriodDays = 7;
    recommendation = 'Adjust category budgets or reallocate from your entertainment budget before completing this transaction.';
  } else {
    decision = 'Safe to Buy';
    badgeClass = 'success';
    explanation = `Great news! You can afford this purchase of ₹${purchaseAmount.toLocaleString()}. After buying ${productName || 'this item'}, you will maintain a healthy balance of ₹${balanceAfterPurchase.toLocaleString()} and fulfill all upcoming bills of ₹${upcomingObligations.toLocaleString()}.`;
    waitingPeriodDays = 0;
    recommendation = 'Proceed mindfully. Log the expense in SpendSmart right after paying so your analytics stay up-to-date.';
  }

  return {
    productName: productName || 'Item',
    purchaseAmount,
    category,
    decision,
    badgeClass,
    availableBalance,
    balanceAfterPurchase: Math.max(0, balanceAfterPurchase),
    upcomingObligations,
    remainingBudget,
    remainingBudgetAfter,
    safeDisposableBuffer: Math.max(0, safeDisposableBuffer),
    waitingPeriodDays,
    explanation,
    recommendation,
  };
}

module.exports = { evaluatePurchase };
