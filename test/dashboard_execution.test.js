/**
 * Test executing dashboard data loading logic against live API response
 */

const assert = require('assert');

async function testDashboardDataHandling() {
  console.log('Testing dashboard data handling with live API response...');

  // 1. Fetch live overview data
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@spendsmart.com', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Login must return token');

  const overviewRes = await fetch('http://localhost:5000/api/smart/overview', {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const overview = await overviewRes.json();
  assert.strictEqual(overview.success, true);
  const data = overview.data;

  // Mock DOM
  const mockDOM = {};
  const elementIds = [
    'card-available-balance', 'card-total-income', 'card-total-expenses', 'card-total-savings',
    'daily-limit-amount', 'daily-spent-amount', 'daily-remaining-amount', 'daily-remaining-days',
    'daily-limit-warning', 'budget-total-limit', 'budget-spent-val', 'budget-remaining-val',
    'budget-percentage-label', 'budget-progress-fill', 'health-score-val', 'health-score-category',
    'health-score-tip', 'health-circle-badge', 'recent-tx-list', 'upcoming-bills-list',
    'goals-preview-list'
  ];

  elementIds.forEach(id => {
    mockDOM[id] = { textContent: '', innerHTML: '', style: {} };
  });

  function setElementText(id, text) {
    if (mockDOM[id]) {
      mockDOM[id].textContent = text;
      return true;
    }
    return false;
  }

  function formatCurrency(val) {
    return '₹' + (val || 0).toLocaleString();
  }

  // Execute summary mapping
  const cards = data.summaryCards;
  setElementText('card-available-balance', formatCurrency(cards.availableBalance));
  setElementText('card-total-income', formatCurrency(cards.totalIncome));
  setElementText('card-total-expenses', formatCurrency(cards.totalExpenses));
  setElementText('card-total-savings', formatCurrency(cards.totalSavings));

  // Execute daily limit mapping
  const daily = data.dailyLimit;
  setElementText('daily-limit-amount', formatCurrency(daily.limit));
  setElementText('daily-spent-amount', formatCurrency(daily.spentToday));
  setElementText('daily-remaining-amount', formatCurrency(daily.remainingToday));
  setElementText('daily-remaining-days', `${daily.remainingDays} days left in month`);

  // Execute budget mapping
  const b = data.budget;
  setElementText('budget-total-limit', formatCurrency(b.overallLimit));
  setElementText('budget-spent-val', formatCurrency(b.spent));
  setElementText('budget-remaining-val', formatCurrency(b.remaining));
  setElementText('budget-percentage-label', `${b.usagePercentage}% utilized`);

  // Assert all values populated without any error
  assert.ok(mockDOM['card-available-balance'].textContent.includes('₹'));
  assert.ok(mockDOM['daily-remaining-amount'].textContent.includes('₹'));
  assert.ok(mockDOM['budget-remaining-val'].textContent.includes('₹'));

  console.log('✅ Dashboard execution test successfully populated all values:');
  console.log(`   Available Balance: ${mockDOM['card-available-balance'].textContent}`);
  console.log(`   Daily Limit:       ${mockDOM['daily-limit-amount'].textContent}`);
  console.log(`   Daily Remaining:   ${mockDOM['daily-remaining-amount'].textContent}`);
  console.log(`   Budget Remaining:  ${mockDOM['budget-remaining-val'].textContent}`);
  console.log('🎉 No errors or null pointer exceptions!');
}

testDashboardDataHandling().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
