const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');

/**
 * Transparent Financial Health Score (0 - 100)
 * Evaluates real MongoDB student financial data across 5 core pillars.
 *
 * Scoring breakdown (max 100 pts):
 *   Pillar 1 – Savings Consistency    : 25 pts  (income retained / saved)
 *   Pillar 2 – Budget Adherence       : 25 pts  (expenses vs monthly budget)
 *   Pillar 3 – Expense Pacing         : 20 pts  (daily burn rate vs month timeline)
 *   Pillar 4 – Needs vs Wants Balance : 15 pts  (% of wants in total spending)
 *   Pillar 5 – Savings Goal Progress  : 15 pts  (average completion across goals)
 */
async function calculateHealthScore(userId) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Fetch current month transactions
  const monthTransactions = await Transaction.find({
    user: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let needsExpenses = 0;
  let wantsExpenses = 0;

  monthTransactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
      if (tx.classification === 'need') {
        needsExpenses += tx.amount;
      } else {
        wantsExpenses += tx.amount;
      }
    }
  });

  // 2. Fetch active budget
  const budget = await Budget.findOne({ user: userId, month: currentMonthStr });
  const overallLimit = budget
    ? budget.overallLimit
    : totalIncome > 0
    ? totalIncome * 0.8
    : 0;

  // 3. Fetch savings goals
  const goals = await SavingsGoal.find({ user: userId });

  // ─────────────────────────────────────────────────────────────
  // PILLAR 1: Savings Consistency (Max 25 pts)
  // Measures: how much of this month's income was retained (not spent)
  // Formula: savingsRate = max(0, monthIncome - monthExpenses) / monthIncome
  // ─────────────────────────────────────────────────────────────
  let savingsRateScore = 0;
  let savingsRate = 0;
  if (totalIncome > 0) {
    const netSaved = totalIncome - totalExpenses;
    savingsRate = Math.max(0, netSaved) / totalIncome;
    if (savingsRate >= 0.25) {
      savingsRateScore = 25; // Saving 25%+ of income
    } else if (savingsRate >= 0.15) {
      savingsRateScore = 20; // Saving 15–24%
    } else if (savingsRate >= 0.05) {
      savingsRateScore = 15; // Saving 5–14%
    } else if (netSaved > 0) {
      savingsRateScore = 10; // Saving something, below 5%
    } else {
      savingsRateScore = 5;  // Expenses >= income this month
    }
  } else {
    // No income recorded yet this month
    savingsRateScore = totalExpenses === 0 ? 15 : 10;
  }

  // ─────────────────────────────────────────────────────────────
  // PILLAR 2: Budget Adherence (Max 25 pts)
  // Measures: monthExpenses vs overallBudget
  // Formula: budgetUsageRate = monthExpenses / overallLimit
  // ─────────────────────────────────────────────────────────────
  let budgetScore = 0;
  let budgetUsageRate = 0;
  if (overallLimit > 0) {
    budgetUsageRate = totalExpenses / overallLimit;
    if (budgetUsageRate <= 0.70) {
      budgetScore = 25; // Comfortably within budget
    } else if (budgetUsageRate <= 0.85) {
      budgetScore = 22; // On track
    } else if (budgetUsageRate <= 1.0) {
      budgetScore = 18; // Close to limit but not exceeded
    } else if (budgetUsageRate <= 1.15) {
      budgetScore = 10; // Exceeded by up to 15%
    } else {
      budgetScore = 4;  // Significantly over budget
    }
  } else {
    budgetScore = 15; // Neutral baseline when no budget set yet
  }

  // ─────────────────────────────────────────────────────────────
  // PILLAR 3: Expense Pacing / Velocity (Max 20 pts)
  // Measures: actual spending vs expected spending paced evenly over the month
  // Formula: expectedSpendSoFar = overallLimit × (currentDay / totalDaysInMonth)
  // ─────────────────────────────────────────────────────────────
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const monthProgress = currentDay / totalDaysInMonth;
  let expenseControlScore = 0;

  if (overallLimit > 0) {
    const expectedSpendSoFar = overallLimit * monthProgress;
    if (totalExpenses <= expectedSpendSoFar) {
      expenseControlScore = 20; // Perfect or ahead of pacing schedule
    } else if (totalExpenses <= expectedSpendSoFar * 1.2) {
      expenseControlScore = 14; // Slightly over-paced
    } else {
      expenseControlScore = 8;  // Significantly over-paced
    }
  } else {
    expenseControlScore = 15; // Neutral when no budget set
  }

  // ─────────────────────────────────────────────────────────────
  // PILLAR 4: Needs vs Wants Balance (Max 15 pts)
  // Student target ratio: Needs 60–70%, Wants 30–40% or lower
  // Formula: wantsPercentage = (wantsExpenses / totalExpenses) × 100
  // ─────────────────────────────────────────────────────────────
  let needsWantsScore = 0;
  let wantsPercentage = 0;
  if (totalExpenses > 0) {
    wantsPercentage = (wantsExpenses / totalExpenses) * 100;
    if (wantsPercentage <= 30) {
      needsWantsScore = 15; // Excellent impulse control
    } else if (wantsPercentage <= 45) {
      needsWantsScore = 12; // Good balance
    } else if (wantsPercentage <= 60) {
      needsWantsScore = 8;  // Borderline high wants
    } else {
      needsWantsScore = 4;  // Wants dominating expenses
    }
  } else {
    needsWantsScore = 15; // No expenses yet — full marks
  }

  // ─────────────────────────────────────────────────────────────
  // PILLAR 5: Savings Goal Progress (Max 15 pts)
  // Formula: avgProgress = average of (currentAmount / targetAmount × 100) across all goals
  // ─────────────────────────────────────────────────────────────
  let goalScore = 0;
  let avgGoalProgress = 0;
  if (goals.length > 0) {
    avgGoalProgress =
      goals.reduce(
        (acc, g) =>
          acc + (g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0),
        0
      ) / goals.length;

    if (avgGoalProgress >= 70) {
      goalScore = 15;
    } else if (avgGoalProgress >= 40) {
      goalScore = 12;
    } else if (avgGoalProgress >= 15) {
      goalScore = 9;
    } else {
      goalScore = 6;
    }
  } else {
    goalScore = 8; // Default baseline — encourages goal creation
  }

  // ─────────────────────────────────────────────────────────────
  // Final Score
  // ─────────────────────────────────────────────────────────────
  const rawTotal =
    savingsRateScore + budgetScore + expenseControlScore + needsWantsScore + goalScore;
  const totalScore = Math.min(100, Math.max(10, Math.round(rawTotal)));

  let category = 'Needs Attention';
  let badgeColor = '#CE8276';
  if (totalScore >= 80) {
    category = 'Excellent';
    badgeColor = '#294C3A';
  } else if (totalScore >= 65) {
    category = 'Good';
    badgeColor = '#6B9B7B';
  } else if (totalScore >= 50) {
    category = 'Fair';
    badgeColor = '#F2DDA4';
  }

  // ─────────────────────────────────────────────────────────────
  // Scoring Breakdown — accurate human-readable explanation
  // ─────────────────────────────────────────────────────────────
  const scoreBreakdownText =
    `Score = Savings ${savingsRateScore}/25 + Budget ${budgetScore}/25 ` +
    `+ Pacing ${expenseControlScore}/20 + Needs/Wants ${needsWantsScore}/15 ` +
    `+ Goals ${goalScore}/15`;

  // Generate actionable tips based on weakest pillar
  const suggestions = [];

  // Tip based on actual wantsPercentage (Pillar 4)
  if (wantsPercentage > 40) {
    suggestions.push(
      `Your non-essential 'Wants' account for ${Math.round(wantsPercentage)}% of spending. ` +
        `Cutting back on food delivery and shopping can boost your score by 7+ points.`
    );
  }

  // Tip based on budget adherence (Pillar 2)
  if (overallLimit > 0 && totalExpenses > overallLimit * 0.85) {
    suggestions.push(
      `You have reached ${Math.round(budgetUsageRate * 100)}% of your monthly budget. ` +
        `Slow down daily discretionary spends for the remaining ${totalDaysInMonth - currentDay} days.`
    );
  }

  // Tip for no savings goals (Pillar 5)
  if (goals.length === 0) {
    suggestions.push(
      'Create at least one Savings Goal (e.g., Emergency Fund or Semester Books) to earn full goal consistency points.'
    );
  }

  // Tip for low savings rate (Pillar 1)
  if (savingsRate < 0.15 && totalIncome > 0) {
    suggestions.push(
      'Aim to set aside at least 15% of your allowance on the day you receive it (Pay Yourself First rule).'
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Outstanding financial discipline! Keep your daily expenses consistent and continue funding your savings goals.'
    );
  }

  return {
    score: totalScore,
    category,
    badgeColor,
    month: currentMonthStr,
    // scoreBreakdownText is the accurate explanation to show in the UI
    scoreBreakdownText,
    components: {
      savingsConsistency: {
        score: savingsRateScore,
        max: 25,
        title: 'Savings Consistency',
        details:
          totalIncome > 0
            ? `${Math.round(savingsRate * 100)}% of this month's income retained`
            : 'No income recorded yet this month',
      },
      budgetAdherence: {
        score: budgetScore,
        max: 25,
        title: 'Budget Adherence',
        details:
          overallLimit > 0
            ? `${Math.round(budgetUsageRate * 100)}% of ₹${overallLimit.toLocaleString('en-IN')} budget used`
            : 'No budget set — set one to score higher',
      },
      expenseControl: {
        score: expenseControlScore,
        max: 20,
        title: 'Expense Pacing',
        details:
          overallLimit > 0
            ? `Actual ₹${totalExpenses.toLocaleString('en-IN')} vs expected ₹${Math.round(overallLimit * monthProgress).toLocaleString('en-IN')} for day ${currentDay}/${totalDaysInMonth}`
            : 'Set a budget to enable pacing analysis',
      },
      needsVsWants: {
        score: needsWantsScore,
        max: 15,
        title: 'Needs vs Wants Balance',
        details:
          totalExpenses > 0
            ? `${Math.round(100 - wantsPercentage)}% needs / ${Math.round(wantsPercentage)}% wants`
            : 'No expenses logged yet',
      },
      savingsGoals: {
        score: goalScore,
        max: 15,
        title: 'Savings Goal Progress',
        details:
          goals.length > 0
            ? `${goals.length} goal${goals.length === 1 ? '' : 's'} — avg ${Math.round(avgGoalProgress)}% complete`
            : 'No savings goals created yet',
      },
    },
    suggestions,
    metrics: {
      totalIncome,
      totalExpenses,
      // Note: availableBalance here is current-month-only, not global balance
      monthNetBalance: totalIncome - totalExpenses,
      wantsPercentage: Math.round(wantsPercentage),
      needsPercentage: Math.round(100 - wantsPercentage),
    },
  };
}

module.exports = { calculateHealthScore };
