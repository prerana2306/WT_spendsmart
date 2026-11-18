/**
 * What-If Savings Simulator Service
 * Computes dynamic financial outcomes based on habit changes, daily micro-savings, and expense cutbacks.
 */
function runSimulation({
  monthlyIncome = 0,
  monthlyExpenses = 0,
  additionalDailySavings = 0,
  additionalWeeklySavings = 0,
  plannedExpenseCut = 0,
  targetSavingsAmount = 10000,
  months = 6,
}) {
  const income = parseFloat(monthlyIncome) || 0;
  const expenses = parseFloat(monthlyExpenses) || 0;
  const dailyExtra = parseFloat(additionalDailySavings) || 0;
  const weeklyExtra = parseFloat(additionalWeeklySavings) || 0;
  const expenseCut = parseFloat(plannedExpenseCut) || 0;
  const target = parseFloat(targetSavingsAmount) || 10000;
  const durationMonths = Math.min(24, Math.max(1, parseInt(months) || 6));

  // Current baseline monthly savings
  const baselineMonthlySavings = Math.max(0, income - expenses);

  // Additional monthly savings from new habits:
  // 30 days per month for daily savings, ~4.33 weeks per month for weekly
  const monthlyFromDaily = dailyExtra * 30;
  const monthlyFromWeekly = weeklyExtra * 4.33;
  const monthlyFromCuts = expenseCut;

  const totalAdditionalMonthly = monthlyFromDaily + monthlyFromWeekly + monthlyFromCuts;
  const projectedMonthlySavings = baselineMonthlySavings + totalAdditionalMonthly;

  // Month-by-month trajectory
  const timeline = [];
  let cumBaseline = 0;
  let cumProjected = 0;

  for (let m = 1; m <= durationMonths; m++) {
    cumBaseline += baselineMonthlySavings;
    cumProjected += projectedMonthlySavings;

    timeline.push({
      month: `Month ${m}`,
      baselineCumulative: Math.round(cumBaseline),
      projectedCumulative: Math.round(cumProjected),
      difference: Math.round(cumProjected - cumBaseline),
    });
  }

  // Time to reach target
  let monthsToTargetBaseline = baselineMonthlySavings > 0 ? Math.ceil(target / baselineMonthlySavings) : null;
  let monthsToTargetProjected = projectedMonthlySavings > 0 ? Math.ceil(target / projectedMonthlySavings) : null;

  let timeSavedMonths = null;
  if (monthsToTargetBaseline && monthsToTargetProjected) {
    timeSavedMonths = Math.max(0, monthsToTargetBaseline - monthsToTargetProjected);
  }

  return {
    baselineMonthlySavings: Math.round(baselineMonthlySavings),
    projectedMonthlySavings: Math.round(projectedMonthlySavings),
    totalAdditionalMonthly: Math.round(totalAdditionalMonthly),
    totalProjectedAfterDuration: Math.round(cumProjected),
    totalBaselineAfterDuration: Math.round(cumBaseline),
    netGain: Math.round(cumProjected - cumBaseline),
    targetSavingsAmount: target,
    durationMonths,
    monthsToTargetBaseline,
    monthsToTargetProjected,
    timeSavedMonths,
    timeline,
    summaryInsights: [
      `Saving ₹${dailyExtra} extra each day yields an additional ₹${Math.round(monthlyFromDaily).toLocaleString()} every month.`,
      `With these habits, you will accumulate ₹${Math.round(cumProjected).toLocaleString()} in ${durationMonths} months — ₹${Math.round(cumProjected - cumBaseline).toLocaleString()} more than your current baseline.`,
      monthsToTargetProjected
        ? `You will reach your ₹${target.toLocaleString()} goal in approximately ${monthsToTargetProjected} month${monthsToTargetProjected === 1 ? '' : 's'}${timeSavedMonths ? ` (${timeSavedMonths} months faster!)` : ''}.`
        : 'Adjust your savings rate to estimate when you will reach your target.',
    ],
  };
}

module.exports = { runSimulation };
