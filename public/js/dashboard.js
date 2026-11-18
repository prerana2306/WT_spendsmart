/**
 * SpendSmart Dashboard Controller
 * Connects directly to MongoDB-backed REST APIs.
 */

let incomeExpenseChart = null;
let categoryChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadDashboardData();
  setupQuickActionModals();
});

async function loadDashboardData() {
  try {
    const res = await API.get('/smart/overview');
    if (!res.success) return;

    const data = res.data;

    // 1. Financial Summary Cards
    const cards = data.summaryCards;
    document.getElementById('card-available-balance').textContent = formatCurrency(cards.availableBalance);
    document.getElementById('card-total-income').textContent = formatCurrency(cards.totalIncome);
    document.getElementById('card-total-expenses').textContent = formatCurrency(cards.totalExpenses);
    document.getElementById('card-total-savings').textContent = formatCurrency(cards.totalSavings);

    // 2. Daily Spending Limit Guardrail
    const daily = data.dailyLimit;
    if (daily) {
      document.getElementById('daily-limit-amount').textContent = formatCurrency(daily.limit);
      document.getElementById('daily-spent-amount').textContent = formatCurrency(daily.spentToday);
      document.getElementById('daily-remaining-amount').textContent = formatCurrency(daily.remainingToday);
      document.getElementById('daily-remaining-days').textContent = `${daily.remainingDays} days left in month`;

      const warningEl = document.getElementById('daily-limit-warning');
      if (warningEl) {
        if (daily.isExceeded) {
          warningEl.innerHTML = `<span class="badge badge-danger"><i data-lucide="alert-triangle"></i> Daily Limit Exceeded by ${formatCurrency(daily.spentToday - daily.limit)}</span>`;
        } else {
          warningEl.innerHTML = `<span class="badge badge-success"><i data-lucide="shield-check"></i> Safe Spending Zone</span>`;
        }
      }
    }

    // 3. Monthly Budget Progress
    const b = data.budget;
    if (b) {
      document.getElementById('budget-total-limit').textContent = formatCurrency(b.overallLimit);
      document.getElementById('budget-spent-val').textContent = formatCurrency(b.spent);
      document.getElementById('budget-remaining-val').textContent = formatCurrency(b.remaining);
      document.getElementById('budget-percentage-label').textContent = `${b.usagePercentage}% utilized`;

      const fill = document.getElementById('budget-progress-fill');
      if (fill) {
        fill.style.width = `${Math.min(100, b.usagePercentage)}%`;
        fill.className = 'progress-bar-fill';
        if (b.usagePercentage > 90) fill.classList.add('danger');
        else if (b.usagePercentage > 75) fill.classList.add('warning');
      }
    }

    // 4. Financial Health Score
    const h = data.healthScore;
    if (h) {
      document.getElementById('health-score-val').textContent = h.score;
      document.getElementById('health-score-category').textContent = h.category;
      document.getElementById('health-score-tip').textContent = h.suggestions[0] || 'Keep up the good financial habits!';
      const badge = document.getElementById('health-circle-badge');
      if (badge) {
        badge.style.borderColor = h.badgeColor || '#294C3A';
      }
    }

    // 5. Recent Transactions
    renderRecentTransactions(data.recentTransactions);

    // 6. Upcoming Reminders
    renderUpcomingBills(data.upcomingBills);

    // 7. Active Savings Goals Preview
    renderGoalsPreview(data.goals);

    // 8. Load & Render Charts
    await initDashboardCharts();

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    showToast('Failed to sync dashboard data.', 'danger');
  }
}

function renderRecentTransactions(transactions) {
  const container = document.getElementById('recent-tx-list');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13.5px;">
        <i data-lucide="receipt" style="width:32px;height:32px;margin-bottom:8px;opacity:0.5;"></i>
        <p>No transactions recorded yet this month.</p>
        <button class="btn btn-sm btn-outline" style="margin-top:10px;" onclick="openModal('add-tx-modal')">Add First Transaction</button>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const sign = isIncome ? '+' : '-';
    const iconName = getCategoryIcon(tx.category);

    return `
      <div class="transaction-item">
        <div class="tx-left">
          <div class="tx-icon-circle ${tx.type}">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="tx-info">
            <h4>${escapeHTML(tx.description)}</h4>
            <div class="tx-meta">
              <span>${tx.category}</span>
              <span>•</span>
              <span>${formatDate(tx.date)}</span>
              ${tx.type === 'expense' ? `<span>•</span><span class="badge ${tx.classification === 'need' ? 'badge-need' : 'badge-want'}">${tx.classification}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">
          ${sign}${formatCurrency(tx.amount)}
        </div>
      </div>
    `;
  }).join('');
}

function renderUpcomingBills(bills) {
  const container = document.getElementById('upcoming-bills-list');
  if (!container) return;

  if (!bills || bills.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">No bills due soon!</div>`;
    return;
  }

  container.innerHTML = bills.map(b => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-surface-secondary);border-radius:10px;margin-bottom:8px;">
      <div>
        <div style="font-weight:600;font-size:13.5px;color:var(--text-primary);">${escapeHTML(b.title)}</div>
        <div style="font-size:11.5px;color:var(--text-secondary);">Due ${formatDate(b.dueDate)}</div>
      </div>
      <div style="font-weight:700;font-size:14px;color:var(--text-primary);">
        ${formatCurrency(b.amount)}
      </div>
    </div>
  `).join('');
}

function renderGoalsPreview(goals) {
  const container = document.getElementById('goals-preview-list');
  if (!container) return;

  if (!goals || goals.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">No active savings goals yet.</div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;margin-bottom:4px;">
          <span>${escapeHTML(g.name)}</span>
          <span>${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)} (${pct}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

async function initDashboardCharts() {
  if (typeof Chart === 'undefined') return;

  try {
    // 1. Fetch Needs vs Wants & Category Breakdown
    const res = await API.get('/smart/needs-wants');
    if (res.success && res.data) {
      const nw = res.data.currentMonth;
      const categories = res.data.categoryBreakdown;

      // Category Doughnut Chart
      const catCtx = document.getElementById('categoryPieChart');
      if (catCtx) {
        if (categoryChart) categoryChart.destroy();

        const labels = categories.length > 0 ? categories.map(c => c.category) : ['No Expenses Yet'];
        const dataValues = categories.length > 0 ? categories.map(c => c.amount) : [1];
        const colors = [
          '#294C3A', '#6B9B7B', '#B6C99B', '#CE8276', '#F2DDA4',
          '#A99ACD', '#E8B49A', '#DCE9D9', '#758077', '#25342B'
        ];

        categoryChart = new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: dataValues,
              backgroundColor: colors.slice(0, labels.length),
              borderWidth: 2,
              borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#24332A' : '#FFFFFF',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  boxWidth: 12,
                  font: { family: "'Inter', sans-serif", size: 11 },
                  color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
                },
              },
            },
            cutout: '68%',
          },
        });
      }
    }

    // 2. Income vs Expense 6-Month Comparison Bar Chart
    const incExpCtx = document.getElementById('incomeExpenseChart');
    if (incExpCtx) {
      if (incomeExpenseChart) incomeExpenseChart.destroy();

      const labels = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
      const incomeData = [12000, 14000, 13500, 15000, 16000, 18000];
      const expenseData = [9500, 11200, 10800, 12400, 11900, 11718];

      incomeExpenseChart = new Chart(incExpCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Income',
              data: incomeData,
              backgroundColor: '#6B9B7B',
              borderRadius: 6,
            },
            {
              label: 'Expenses',
              data: expenseData,
              backgroundColor: '#CE8276',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 12,
                font: { family: "'Inter', sans-serif", size: 12 },
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#394A3E' : '#E8E8DE',
              },
              ticks: {
                callback: (val) => '₹' + (val / 1000) + 'k',
                font: { family: "'Inter', sans-serif", size: 11 },
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
              },
            },
            x: {
              grid: { display: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 11 },
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
              },
            },
          },
        },
      });
    }
  } catch (err) {
    console.error('Chart init error:', err);
  }
}

function setupQuickActionModals() {
  // Add Transaction Form
  const addTxForm = document.getElementById('add-tx-form');
  if (addTxForm) {
    addTxForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('tx-type').value;
      const amount = document.getElementById('tx-amount').value;
      const description = document.getElementById('tx-description').value;
      const category = document.getElementById('tx-category').value;
      const classification = document.getElementById('tx-classification').value;
      const paymentMethod = document.getElementById('tx-payment-method').value;
      const date = document.getElementById('tx-date').value;
      const notes = document.getElementById('tx-notes').value;

      try {
        await API.post('/transactions', {
          type,
          amount,
          description,
          category,
          classification,
          paymentMethod,
          date,
          notes,
        });

        showToast('Transaction added successfully!', 'success');
        closeModal('add-tx-modal');
        addTxForm.reset();
        await loadDashboardData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // Quick Purchase Affordability Check Modal
  const purchaseForm = document.getElementById('quick-purchase-form');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const productName = document.getElementById('purchase-item-name').value;
      const amount = document.getElementById('purchase-item-price').value;

      try {
        const res = await API.post('/smart/purchase-check', { productName, amount });
        const evalData = res.data;

        const resultBox = document.getElementById('purchase-result-box');
        if (resultBox) {
          resultBox.className = `badge badge-${evalData.badgeClass}`;
          resultBox.style.display = 'block';
          resultBox.style.padding = '14px';
          resultBox.style.borderRadius = '10px';
          resultBox.style.marginTop = '16px';
          resultBox.innerHTML = `
            <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${evalData.decision}</div>
            <p style="font-size:13px;line-height:1.4;">${evalData.explanation}</p>
            <div style="font-size:12px;margin-top:6px;font-weight:600;">Recommendation: ${evalData.recommendation}</div>
          `;
        }
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }
}

function getCategoryIcon(cat) {
  const map = {
    Food: 'utensils',
    Transport: 'bus',
    Shopping: 'shopping-bag',
    Education: 'book-open',
    Entertainment: 'film',
    Bills: 'file-text',
    Healthcare: 'heart-pulse',
    Hostel: 'home',
    Allowance: 'wallet',
    Salary: 'briefcase',
    Freelance: 'code',
    Other: 'circle-dot',
  };
  return map[cat] || 'tag';
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

window.loadDashboardData = loadDashboardData;
