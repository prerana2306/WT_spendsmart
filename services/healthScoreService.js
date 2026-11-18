const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');

/**
 * Transparent Financial Health Score (0 - 100)
 * Evaluates real MongoDB student financial data across 5 core pillars.
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
  const overallLimit = budget ? budget.overallLimit : (totalIncome > 0 ? totalIncome * 0.8 : 0);

  // 3. Fetch savings goals
  const goals = await SavingsGoal.find({ user: userId });

  // PILLAR 1: Savings Consistency (Max 25 pts)
  // How much of income is retained or saved
  let savingsRateScore = 0;
  let savingsRate = 0;
  if (totalIncome > 0) {
    const netSaved = totalIncome - totalExpenses;
    savingsRate = Math.max(0, netSaved) / totalIncome;
    if (savingsRate >= 0.25) {
      savingsRateScore = 25;
    } else if (savingsRate >= 0.15) {
      savingsRateScore = 20;
    } else if (savingsRate >= 0.05) {
      savingsRateScore = 15;
    } else if (netSaved > 0) {
      savingsRateScore = 10;
    } else {
      savingsRateScore = 5;
    }
  } else {
    // If no income recorded yet this month
    savingsRateScore = totalExpenses === 0 ? 15 : 10;
  }

  // PILLAR 2: Budget Adherence (Max 25 pts)
  let budgetScore = 0;
  let budgetUsageRate = 0;
  if (overallLimit > 0) {
    budgetUsageRate = totalExpenses / overallLimit;
    if (budgetUsageRate <= 0.70) {
      budgetScore = 25; // Safely within budget
    } else if (budgetUsageRate <= 0.85) {
      budgetScore = 22;
    } else if (budgetUsageRate <= 1.0) {
      budgetScore = 18; // Close to limit but not exceeded
    } else if (budgetUsageRate <= 1.15) {
      budgetScore = 10; // Exceeded by up to 15%
    } else {
      budgetScore = 4; // Significantly over budget
    }
  } else {
    budgetScore = 15; // Neutral baseline when no budget set yet
  }

  // PILLAR 3: Expense Control & Velocity (Max 20 pts)
  // Check daily pacing vs days passed in month
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const monthProgress = currentDay / totalDaysInMonth;
  let expenseControlScore = 0;

  if (overallLimit > 0) {
    const expectedSpendSoFar = overallLimit * monthProgress;
    if (totalExpenses <= expectedSpendSoFar) {
      expenseControlScore = 20; // Perfect spending velocity
    } else if (totalExpenses <= expectedSpendSoFar * 1.2) {
      expenseControlScore = 14;
    } else {
      expenseControlScore = 8;
    }
  } else {
    expenseControlScore = 15;
  }

  // PILLAR 4: Needs vs Wants Balance (Max 15 pts)
  // Recommended student ratio: Needs ~60-70%, Wants ~30-40% or lower
  let needsWantsScore = 0;
  let wantsPercentage = 0;
  if (totalExpenses > 0) {
    wantsPercentage = (wantsExpenses / totalExpenses) * 100;
    if (wantsPercentage <= 30) {
      needsWantsScore = 15; // Excellent impulse control
    } else if (wantsPercentage <= 45) {
      needsWantsScore = 12; // Good balance
    } else if (wantsPercentage <= 60) {
      needsWantsScore = 8; // Borderline high wants
    } else {
      needsWantsScore = 4; // Wants dominating expenses
    }
  } else {
    needsWantsScore = 15;
  }

  // PILLAR 5: Savings Goal Progress (Max 15 pts)
  let goalScore = 0;
  if (goals.length > 0) {
    const avgProgress =
      goals.reduce((acc, g) => acc + (g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0), 0) /
      goals.length;
    if (avgProgress >= 70) {
      goalScore = 15;
    } else if (avgProgress >= 40) {
      goalScore = 12;
    } else if (avgProgress >= 15) {
      goalScore = 9;
    } else {
      goalScore = 6;
    }
  } else {
    goalScore = 8; // Default baseline encouraging goal creation
  }

  const rawTotal = savingsRateScore + budgetScore + expenseControlScore + needsWantsScore + goalScore;
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

  // Generate actionable tips based on weakest component
  const suggestions = [];
  if (wantsPercentage > 40) {
    suggestions.push(`Your non-essential 'Wants' account for ${Math.round(wantsPercentage)}% of spending. Cutting back on food delivery and shopping can boost your score by 7+ points.`);
  }
  if (overallLimit > 0 && totalExpenses > overallLimit * 0.85) {
    suggestions.push(`You have reached ${Math.round(budgetUsageRate * 100)}% of your monthly budget. Slow down daily discretionary spends for the remaining ${totalDaysInMonth - currentDay} days.`);
  }
  if (goals.length === 0) {
    suggestions.push('Create at least one Savings Goal (e.g., Emergency Fund or Semester Books) to earn full goal consistency points.');
  }
  if (savingsRate < 0.15 && totalIncome > 0) {
    suggestions.push('Aim to set aside at least 15% of your allowance on the day you receive it (Pay Yourself First rule).');
  }
  if (suggestions.length === 0) {
    suggestions.push('Outstanding financial discipline! Keep your daily expenses consistent and continue funding your savings goals.');
  }

  return {
    score: totalScore,
    category,
    badgeColor,
    month: currentMonthStr,
    components: {
      savingsConsistency: {
        score: savingsRateScore,
        max: 25,
        title: 'Savings Consistency',
        details: `${Math.round(savingsRate * 100)}% of income saved`,
      },
      budgetAdherence: {
        score: budgetScore,
        max: 25,
        title: 'Budget Adherence',
        details: overallLimit > 0 ? `${Math.round(budgetUsageRate * 100)}% budget utilized` : 'No budget set',
      },
      expenseControl: {
        score: expenseControlScore,
        max: 20,
        title: 'Expense Pacing',
        details: 'Daily spending rate vs monthly timeline',
      },
      needsVsWants: {
        score: needsWantsScore,
        max: 15,
        title: 'Needs vs Wants Balance',
        details: `${Math.round(100 - wantsPercentage)}% needs / ${Math.round(wantsPercentage)}% wants`,
      },
      savingsGoals: {
        score: goalScore,
        max: 15,
        title: 'Savings Goals Progress',
        details: `${goals.length} active goal${goals.length === 1 ? '' : 's'} tracked`,
      },
    },
    suggestions,
    metrics: {
      totalIncome,
      totalExpenses,
      availableBalance: totalIncome - totalExpenses,
      wantsPercentage: Math.round(wantsPercentage),
      needsPercentage: Math.round(100 - wantsPercentage),
    },
  };
}

module.exports = { calculateHealthScore };
