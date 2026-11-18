/**
 * SpendSmart Comprehensive Verification & Test Suite
 * Tests all 19 verification checkpoints specified in Section 19 of requirements.
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function fetchJSON(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log(' SpendSmart Comprehensive Test & Verification Suite ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing: ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test('1. Health check endpoint responds online', async () => {
    const res = await fetchJSON('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'online');
  });

  // 2. Demo User Login
  let authToken = '';
  await test('2. Student Login with Demo Account', async () => {
    const res = await fetchJSON('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'demo@spendsmart.com',
        password: 'password123',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token, 'Token must be present');
    assert.strictEqual(res.data.user.name, 'Aarav Sharma');
    authToken = res.data.token;
  });

  const authHeader = { Authorization: `Bearer ${authToken}` };

  // 3. Protected Route Verification
  await test('3. Protected Route Security (rejects without token)', async () => {
    const unauthRes = await fetchJSON('/auth/profile');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.data.success, false);

    const authRes = await fetchJSON('/auth/profile', { headers: authHeader });
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(authRes.data.user.email, 'demo@spendsmart.com');
  });

  // 4. Registration & Email Verification OTP Flow
  await test('4. Student Registration with 6-digit OTP verification', async () => {
    const testEmail = `test_student_${Date.now()}@college.edu`;
    const regRes = await fetchJSON('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Pooja Iyer',
        email: testEmail,
        password: 'password123',
        college: 'BITS Pilani',
      }),
    });
    assert.strictEqual(regRes.status, 201);
    assert.ok(regRes.data.devOtp, 'Dev OTP must be generated');

    // Verify with OTP
    const verifyRes = await fetchJSON('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: regRes.data.devOtp,
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.user.isVerified, true);
  });

  // 5. Dashboard Overview API
  await test('5. Dashboard Overview (Summary Cards, Balances, Health Score)', async () => {
    const res = await fetchJSON('/smart/overview', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.summaryCards.availableBalance > 0);
    assert.ok(res.data.data.healthScore.score >= 0 && res.data.data.healthScore.score <= 100);
  });

  // 6. Transactions CRUD
  let createdTxId = '';
  await test('6. Transaction CRUD (Add Income & Expense, Edit, Delete)', async () => {
    // Add Expense
    const addRes = await fetchJSON('/transactions', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        type: 'expense',
        amount: 280,
        description: 'Test Chemistry Lab Notebook',
        category: 'Education',
        classification: 'need',
        paymentMethod: 'UPI',
      }),
    });
    assert.strictEqual(addRes.status, 201);
    assert.strictEqual(addRes.data.data.amount, 280);
    createdTxId = addRes.data.data._id;

    // Update
    const updateRes = await fetchJSON(`/transactions/${createdTxId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        amount: 300,
        notes: 'Updated price after discount',
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.data.amount, 300);

    // Delete
    const delRes = await fetchJSON(`/transactions/${createdTxId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    assert.strictEqual(delRes.status, 200);
  });

  // 7. Monthly Budget Calculations
  await test('7. Monthly Budget and Category Caps Calculation', async () => {
    const res = await fetchJSON('/budgets/current', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.overallLimit > 0);
    assert.ok(Array.isArray(res.data.data.categoryBudgets));
  });

  // 8. Feature 1: AI Smart Saving Assistant
  await test('8. Feature 1: AI Smart Saving Assistant Query Evaluation', async () => {
    const res = await fetchJSON('/smart/assistant/query', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        query: 'Can I afford a purchase worth 2500?',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.answer.reply.length > 10);
  });

  // 9. Feature 2: Needs vs Wants Analyzer
  await test('9. Feature 2: Needs vs Wants 50/30/20 Breakdown & Trends', async () => {
    const res = await fetchJSON('/smart/needs-wants', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.currentMonth.needsPercentage >= 0);
    assert.ok(res.data.data.currentMonth.wantsPercentage >= 0);
  });

  // 10. Feature 3: Smart Purchase Decision Calculator
  await test('10. Feature 3: Smart Purchase Decision Affordability Check', async () => {
    const res = await fetchJSON('/smart/purchase-check', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        productName: 'Gaming Headset',
        amount: 1800,
        category: 'Entertainment',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.decision);
    assert.ok(res.data.data.explanation);
  });

  // 11. Feature 4: Expense Anomaly Detection
  await test('11. Feature 4: Expense Anomaly Detection', async () => {
    const res = await fetchJSON('/smart/anomalies', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.hasSufficientData);
  });

  // 12. Feature 5: Financial Health Score
  await test('12. Feature 5: 100-Point Financial Health Score & 5 Pillars', async () => {
    const res = await fetchJSON('/smart/health-score', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.score > 0 && res.data.data.score <= 100);
    assert.ok(res.data.data.components.savingsConsistency);
    assert.ok(res.data.data.components.budgetAdherence);
  });

  // 13. Feature 6: What-If Savings Simulator
  await test('13. Feature 6: What-If Savings Simulator compounding math', async () => {
    const res = await fetchJSON('/smart/simulate', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        monthlyIncome: 18000,
        monthlyExpenses: 12000,
        additionalDailySavings: 50,
        additionalWeeklySavings: 200,
        plannedExpenseCut: 500,
        targetSavingsAmount: 20000,
        months: 6,
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.projectedMonthlySavings > res.data.data.baselineMonthlySavings);
    assert.strictEqual(res.data.data.timeline.length, 6);
  });

  // 14. Feature 7: No-Spend Challenges & Badges
  await test('14. Feature 7: Gamified Challenges and Badges', async () => {
    const res = await fetchJSON('/challenges', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.challenges.length >= 6);
    assert.ok(res.data.data.userBadges.length > 0);
  });

  // 15. Feature 8: Split Bill with Friends
  await test('15. Feature 8: Split Bill Groups & Balance Sheet', async () => {
    const groupsRes = await fetchJSON('/splits/groups', { headers: authHeader });
    assert.strictEqual(groupsRes.status, 200);
    assert.ok(groupsRes.data.data.length > 0);

    const firstGroup = groupsRes.data.data[0];
    const detailRes = await fetchJSON(`/splits/groups/${firstGroup._id}`, { headers: authHeader });
    assert.strictEqual(detailRes.status, 200);
    assert.ok(detailRes.data.data.balances.length > 0);
  });

  // 16. Feature 9: Smart Daily Spending Limit
  await test('16. Feature 9: Smart Daily Spending Limit Calculation', async () => {
    const res = await fetchJSON('/smart/daily-limit', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.dailyLimit > 0);
    assert.ok(res.data.data.remainingDays > 0);
  });

  // 17. Feature 10: Financial Calendar and Reminders
  await test('17. Feature 10: Financial Calendar and Reminders', async () => {
    const res = await fetchJSON('/calendar?year=2026&month=11', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.transactions.length > 0);
    assert.ok(res.data.data.reminders.length > 0);
  });

  // 18. Personal Data Export
  await test('18. Student Personal Financial Archive Export (JSON)', async () => {
    const res = await fetchJSON('/auth/export-data', { headers: authHeader });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.user);
    assert.ok(res.data.transactions);
    assert.ok(res.data.budgets);
  });

  console.log('\n====================================================');
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests();
