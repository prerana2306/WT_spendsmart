/**
 * SpendSmart Dashboard Controller
 * Connects directly to MongoDB-backed REST APIs.
 * Redesigned with student-friendly insight messages and real chart data.
 *
 * Calculation Rules (implemented):
 *   Money Left        = Opening Balance + Month Income − Month Expenses
 *   Money Saved       = Sum of savings-goal currentAmount (NOT deducted from Money Left)
 *   Budget Used %     = (Month Expenses / Monthly Budget) × 100
 *   Budget Remaining  = Monthly Budget − Month Expenses
 *   Safe Daily Amount = (Remaining Budget − Upcoming Committed Bills) / Remaining Days
 *   Remaining Today   = Safe Daily Amount − Today's Expenses
 */

let incomeExpenseChart = null;
let categoryChart = null;

// Safe DOM text setter
function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    return true;
  }
  return false;
}

// Safe DOM HTML setter
function setElementHTML(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
    return true;
  }
  return false;
}

/**
 * Format currency in Indian Rupees.
 * Uses actual numeric values — rounding only applied to display abbreviation.
 * ₹1,23,456 → ₹1.2L  |  ₹5,250 → ₹5.3k  |  ₹999 → ₹999
 */
function formatCurrency(val) {
  const num = Number(val || 0);
  if (Math.abs(num) >= 100000) {
    return '₹' + (num / 100000).toFixed(1) + 'L';
  }
  if (Math.abs(num) >= 1000) {
    return '₹' + (num / 1000).toFixed(1) + 'k';
  }
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

/**
 * Format currency in full Indian Rupee format (no abbreviation).
 * Used for tooltip/detail contexts where precision matters.
 */
function formatCurrencyFull(val) {
  const num = Number(val || 0);
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

async function loadDashboardData() {
  try {
    const res = await API.get('/smart/overview');
    if (!res || !res.success || !res.data) {
      console.warn('[SpendSmart Dashboard] Overview API returned empty or unsuccessful response:', res);
      return;
    }

    const data = res.data;

    // 1. Update personalized welcome banner
    updateWelcomeBanner(data);

    // 2. Financial Summary Cards
    //    Money Left  = openingBalance + monthIncome − monthExpenses  (rule 1)
    //    Money Saved = sum of savings-goal contributions             (rule 2, NOT added to balance)
    const cards = data.summaryCards;
    if (cards) {
      // "Money Left" uses the corrected moneyLeft value from backend
      if (cards.moneyLeft !== undefined && cards.moneyLeft !== null) {
        setElementText('card-available-balance', formatCurrency(cards.moneyLeft));
      } else {
        setElementText('card-available-balance', '—');
      }

      setElementText('card-total-income', formatCurrency(cards.totalIncome));
      setElementText('card-total-expenses', formatCurrency(cards.totalExpenses));

      // Money Saved = goal contributions only; not mixed into balance
      setElementText('card-total-savings', formatCurrency(cards.totalSavings));
    }

    // 3. Daily Spending Limit
    //    Safe Daily Amount = discretionaryPool / remainingDays          (rule 5)
    //    Remaining Today   = dailyLimit − todaySpent                   (rule 6)
    const daily = data.dailyLimit;
    if (daily) {
      if (daily.hasDailyLimit) {
        setElementText('daily-limit-amount', formatCurrency(daily.limit));
        setElementText('daily-remaining-amount', formatCurrency(daily.remainingToday));
      } else {
        // No data to calculate — show appropriate message (rule 11)
        setElementText('daily-limit-amount', '—');
        setElementText('daily-remaining-amount', '—');
      }

      setElementText('daily-spent-amount', formatCurrency(daily.spentToday));
      setElementText('daily-remaining-days', `${daily.remainingDays} days left this month`);

      const warningEl = document.getElementById('daily-limit-warning');
      if (warningEl) {
        if (daily.isExceeded) {
          warningEl.innerHTML = `<span class="badge badge-danger"><i data-lucide="alert-triangle"></i> Daily limit exceeded by ${formatCurrency(daily.spentToday - daily.limit)}</span>`;
        } else if (daily.hasDailyLimit) {
          warningEl.innerHTML = `<span class="badge badge-success"><i data-lucide="shield-check"></i> You're within limit!</span>`;
        } else {
          warningEl.innerHTML = `<span class="badge badge-info"><i data-lucide="info"></i> Set a budget to get a daily limit</span>`;
        }
      }
    }

    // 4. Monthly Budget Progress
    //    Budget Used %    = (monthExpenses / monthlyBudget) × 100  (rule 3)
    //    Budget Remaining = monthlyBudget − monthExpenses           (rule 4)
    const b = data.budget;
    if (b) {
      if (b.hasBudget) {
        setElementText('budget-total-limit', formatCurrency(b.overallLimit));
        setElementText('budget-spent-val', formatCurrency(b.spent));
        setElementText('budget-remaining-val', formatCurrency(b.remaining));
        setElementText('budget-percentage-label', `${b.usagePercentage}% used`);

        const fill = document.getElementById('budget-progress-fill');
        if (fill) {
          fill.style.width = `${Math.min(100, b.usagePercentage || 0)}%`;
          fill.className = 'progress-bar-fill';
          if (b.usagePercentage > 90) fill.classList.add('danger');
          else if (b.usagePercentage > 75) fill.classList.add('warning');
        }
      } else {
        // No budget set — show appropriate message (rule 11)
        setElementText('budget-total-limit', '—');
        setElementText('budget-spent-val', formatCurrency(b.spent));
        setElementText('budget-remaining-val', '—');
        setElementText('budget-percentage-label', 'No budget set');

        const fill = document.getElementById('budget-progress-fill');
        if (fill) {
          fill.style.width = '0%';
          fill.className = 'progress-bar-fill';
        }
      }
    }

    // 5. Financial Health Score
    //    Show accurate scoring breakdown (rule 12)
    const h = data.healthScore;
    if (h) {
      setElementText('health-score-val', h.score);
      setElementText('health-score-category', h.category);

      // Show accurate breakdown text as the primary tip
      const breakdownEl = document.getElementById('health-score-tip');
      if (breakdownEl) {
        if (h.scoreBreakdownText) {
          // Show scoring formula first, then the first actionable suggestion
          const tip = h.suggestions && h.suggestions.length > 0
            ? h.suggestions[0]
            : 'Keep up the good habits!';
          breakdownEl.title = h.scoreBreakdownText; // accessible tooltip on hover
          breakdownEl.textContent = tip;
        } else {
          breakdownEl.textContent =
            h.suggestions && h.suggestions.length > 0
              ? h.suggestions[0]
              : 'Keep up the good habits!';
        }
      }

      const badge = document.getElementById('health-circle-badge');
      if (badge) {
        badge.style.borderColor = h.badgeColor || '#294C3A';
        // Store breakdown for accessible tooltip
        if (h.scoreBreakdownText) {
          badge.title = h.scoreBreakdownText;
        }
      }
    }

    // 6. Recent Transactions
    if (data.recentTransactions) {
      renderRecentTransactions(data.recentTransactions);
    }

    // 7. Upcoming Reminders
    if (data.upcomingBills) {
      renderUpcomingBills(data.upcomingBills);
    }

    // 8. Active Savings Goals Preview
    if (data.goals) {
      renderGoalsPreview(data.goals);
    }

    // 9. Student Insight Messages (rule 7: consistent data source)
    renderInsightMessages(data);

    // 10. Load Charts (rule 7: same transaction data as summary cards)
    try {
      await initDashboardCharts();
    } catch (chartErr) {
      console.error('[SpendSmart Dashboard] Chart rendering error:', chartErr);
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    if (window.showToast) {
      showToast('Could not load your dashboard. Please check your connection.', 'danger');
    }
  }
}

function updateWelcomeBanner(data) {
  const user = data.user || {};
  const firstName = (user.name || user.firstName || 'Student').split(' ')[0];

  const bannerText = document.getElementById('welcome-banner-text');
  const bannerSub = document.getElementById('welcome-banner-sub');
  const userInitials = document.getElementById('user-avatar-initials');
  const userNameDisplay = document.getElementById('user-name-display');
  const welcomeHeading = document.getElementById('welcome-heading');

  if (bannerText) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    bannerText.textContent = `${greeting}, ${firstName}! Let's manage your money smartly. 💚`;
  }

  if (bannerSub) {
    const cards = data.summaryCards;
    if (cards && cards.moneyLeft > 0) {
      bannerSub.textContent = `You have ${formatCurrency(cards.moneyLeft)} available this month. Here's your money snapshot.`;
    } else if (cards && cards.moneyLeft < 0) {
      bannerSub.textContent = `You're currently ${formatCurrency(Math.abs(cards.moneyLeft))} over your historical balance — review your spending.`;
    } else {
      bannerSub.textContent = "Here's what's happening with your money this month.";
    }
  }

  if (welcomeHeading) {
    welcomeHeading.textContent = `Welcome back, ${firstName}!`;
  }

  if (userInitials) {
    userInitials.textContent = firstName.charAt(0).toUpperCase();
  }

  if (userNameDisplay) {
    userNameDisplay.textContent = firstName;
  }

  document.querySelectorAll('.user-name-label').forEach(el => {
    el.textContent = firstName;
  });
  document.querySelectorAll('.user-avatar-circle').forEach(el => {
    el.textContent = firstName.charAt(0).toUpperCase();
  });
}

function renderInsightMessages(data) {
  const insightsGrid = document.getElementById('insights-grid');
  const insightsSection = document.getElementById('insights-section');

  if (!insightsGrid || !insightsSection) return;

  const insights = [];
  const cards = data.summaryCards;
  const budget = data.budget;
  const daily = data.dailyLimit;
  const health = data.healthScore;

  // All insights use the same data object from the single /smart/overview API call
  // ensuring consistent date ranges (rule 7)

  if (cards) {
    // Balance insight — uses corrected moneyLeft (rule 1)
    if (typeof cards.moneyLeft === 'number' && cards.moneyLeft > 0) {
      insights.push({
        type: 'tip',
        icon: '💵',
        text: `You have <strong>${formatCurrency(cards.moneyLeft)}</strong> left this month. Spend wisely!`
      });
    } else if (typeof cards.moneyLeft === 'number' && cards.moneyLeft < 0) {
      insights.push({
        type: 'warn',
        icon: '⚠️',
        text: `You are <strong>${formatCurrency(Math.abs(cards.moneyLeft))}</strong> over balance. Avoid new expenses until your next income.`
      });
    }

    // Savings insight — goal contributions only (rule 2)
    if (cards.totalSavings > 0) {
      insights.push({
        type: 'great',
        icon: '🎉',
        text: `You've saved <strong>${formatCurrency(cards.totalSavings)}</strong> towards your goals. Keep it up!`
      });
    }
  }

  // Budget insight (rule 3 — uses usagePercentage from backend formula)
  if (budget && budget.hasBudget) {
    if (budget.usagePercentage > 80) {
      insights.push({
        type: 'warn',
        icon: '⚠️',
        text: `You've used <strong>${budget.usagePercentage}%</strong> of your monthly budget. Try to slow down spending.`
      });
    } else if (budget.usagePercentage < 40) {
      insights.push({
        type: 'great',
        icon: '✅',
        text: `Great job! You've only used <strong>${budget.usagePercentage}%</strong> of your budget so far.`
      });
    }
  } else if (budget && !budget.hasBudget) {
    insights.push({
      type: 'tip',
      icon: '📋',
      text: `No monthly budget set yet. <strong>Set a budget</strong> to unlock daily spending limits and health score accuracy.`
    });
  }

  // Daily limit insight (rule 5)
  if (daily && daily.hasDailyLimit) {
    insights.push({
      type: 'tip',
      icon: '📅',
      text: `You can safely spend about <strong>${formatCurrency(daily.limit)}</strong> per day for the rest of this month.`
    });
  }

  // Health score insight (rule 12 — uses scoreBreakdownText)
  if (health && health.score < 50) {
    insights.push({
      type: 'warn',
      icon: '💡',
      text: `Your money health score is <strong>${health.score}/100</strong>. ${health.suggestions && health.suggestions[0] ? health.suggestions[0] : 'Try logging more transactions to improve it.'}`
    });
  }

  if (insights.length === 0) {
    insightsSection.style.display = 'none';
    return;
  }

  insightsSection.style.display = 'block';
  insightsGrid.innerHTML = insights.slice(0, 3).map(ins => `
    <div class="insight-card ${ins.type}">
      <span class="insight-icon">${ins.icon}</span>
      <span>${ins.text}</span>
    </div>
  `).join('');
}

function renderRecentTransactions(transactions) {
  const container = document.getElementById('recent-tx-list');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:28px;color:var(--text-secondary);font-size:13.5px;">
        <i data-lucide="receipt" style="width:32px;height:32px;margin-bottom:10px;opacity:0.4;display:block;margin-left:auto;margin-right:auto;"></i>
        <p style="font-weight:600;margin-bottom:4px;">No transactions yet</p>
        <p style="font-size:12.5px;">Add your first income or expense to get started!</p>
        <button class="btn btn-sm btn-primary" style="margin-top:14px;" onclick="openNewTransactionModal()">+ Add Transaction</button>
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
              ${tx.type === 'expense' ? `<span>•</span><span class="badge ${tx.classification === 'need' ? 'badge-need' : 'badge-want'}" style="font-size:10px;padding:2px 7px;">${tx.classification === 'need' ? '✅ Need' : '🛒 Want'}</span>` : ''}
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
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">🎉 No upcoming bills due soon!</div>`;
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
    container.innerHTML = `
      <div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">
        <p>No savings goals yet.</p>
        <a href="/goals.html" class="btn btn-sm btn-outline" style="margin-top:10px;">Create a Goal 🎯</a>
      </div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;margin-bottom:5px;">
          <span>${escapeHTML(g.name)}</span>
          <span style="color:var(--sage-green);">${pct}%</span>
        </div>
        <div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:5px;">
          Saved ${formatCurrency(g.currentAmount)} of ${formatCurrency(g.targetAmount)}
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

async function initDashboardCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('[SpendSmart Dashboard] Chart.js is not loaded.');
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#B0BDB2' : '#758077';
  const gridColor = isDark ? '#394A3E' : '#E8E8DE';
  const surfaceColor = isDark ? '#24332A' : '#FFFFFF';

  try {
    // 1. Category Doughnut Chart from real API
    //    Uses /smart/needs-wants which covers current month expenses — same date range (rule 7)
    const needsWantsRes = await API.get('/smart/needs-wants');
    if (needsWantsRes && needsWantsRes.success && needsWantsRes.data) {
      const categories = needsWantsRes.data.categoryBreakdown || [];
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
              borderColor: surfaceColor,
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
                  color: textColor,
                },
              },
              tooltip: {
                callbacks: {
                  // Show full Indian Rupee amount in tooltip (rule 10)
                  label: (ctx) => ` ${ctx.label}: ${formatCurrencyFull(ctx.raw)}`
                }
              }
            },
            cutout: '65%',
          },
        });
      }
    }

    // 2. Income vs Expense Chart — real data from transactions API
    //    Groups last 6 months by month — consistent with current-month summary (rule 7)
    const incExpCtx = document.getElementById('incomeExpenseChart');
    if (incExpCtx) {
      if (incomeExpenseChart) incomeExpenseChart.destroy();

      let labels = [];
      let incomeData = [];
      let expenseData = [];

      try {
        const txRes = await API.get('/transactions?limit=200');
        if (txRes && txRes.success && txRes.data && txRes.data.length > 0) {
          // Group by month (last 6 months)
          const monthMap = {};
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-IN', { month: 'short' });
            monthMap[key] = { label, income: 0, expense: 0 };
          }

          txRes.data.forEach(tx => {
            const date = new Date(tx.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthMap[key]) {
              if (tx.type === 'income') monthMap[key].income += Number(tx.amount);
              else if (tx.type === 'expense') monthMap[key].expense += Number(tx.amount);
            }
          });

          labels = Object.values(monthMap).map(m => m.label);
          incomeData = Object.values(monthMap).map(m => m.income);
          expenseData = Object.values(monthMap).map(m => m.expense);
        }
      } catch (e) {
        console.warn('[SpendSmart] Could not fetch real chart data, using placeholder');
      }

      // Fallback if no real data
      if (labels.length === 0) {
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
        }
        labels = months;
        incomeData = [0, 0, 0, 0, 0, 0];
        expenseData = [0, 0, 0, 0, 0, 0];
      }

      incomeExpenseChart = new Chart(incExpCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Money Received',
              data: incomeData,
              backgroundColor: '#6B9B7B',
              borderRadius: 7,
            },
            {
              label: 'Money Spent',
              data: expenseData,
              backgroundColor: '#CE8276',
              borderRadius: 7,
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
                color: textColor,
              },
            },
            tooltip: {
              callbacks: {
                // Show full Indian Rupee amount in chart tooltip (rule 10)
                label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyFull(ctx.raw)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                callback: (val) => val >= 1000 ? '₹' + (val / 1000).toFixed(0) + 'k' : '₹' + val,
                font: { family: "'Inter', sans-serif", size: 11 },
                color: textColor,
              },
            },
            x: {
              grid: { display: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 11 },
                color: textColor,
              },
            },
          },
        },
      });
    }
  } catch (err) {
    console.error('[SpendSmart Dashboard] Chart init error:', err);
  }
}

function setupQuickActionModals() {
  // Add Transaction Form (dashboard quick modal)
  const addTxForm = document.getElementById('add-tx-form');
  if (addTxForm) {
    addTxForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('tx-type')?.value || 'expense';
      const amount = document.getElementById('tx-amount')?.value;
      const description = document.getElementById('tx-description')?.value;
      const category = document.getElementById('tx-category')?.value || 'Other';
      const classification = document.getElementById('tx-classification')?.value || 'need';
      const paymentMethod = document.getElementById('tx-payment-method')?.value || 'UPI';
      const date = document.getElementById('tx-date')?.value;
      const notes = document.getElementById('tx-notes')?.value;

      try {
        const submitBtn = addTxForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

        await API.post('/transactions', {
          type, amount, description, category, classification, paymentMethod, date, notes,
        });

        if (window.showToast) showToast('Transaction saved successfully! 🎉', 'success');
        closeModal('add-tx-modal');
        addTxForm.reset();
        document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
        await loadDashboardData();
      } catch (err) {
        if (window.showToast) showToast(err.message || 'Could not save transaction.', 'danger');
      } finally {
        const submitBtn = addTxForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Transaction'; }
      }
    });
  }

  // Can I Afford This? Modal
  const purchaseForm = document.getElementById('quick-purchase-form');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const productName = document.getElementById('purchase-item-name')?.value || 'Item';
      const amount = document.getElementById('purchase-item-price')?.value;

      try {
        const res = await API.post('/smart/purchase-check', { productName, amount });
        const evalData = res.data;

        const resultBox = document.getElementById('purchase-result-box');
        if (resultBox && evalData) {
          const decisionEmoji = evalData.badgeClass === 'success' ? '✅' :
                                evalData.badgeClass === 'warning' ? '⚠️' : '❌';

          resultBox.style.display = 'block';
          resultBox.style.padding = '16px';
          resultBox.style.borderRadius = '12px';
          resultBox.style.marginTop = '16px';
          resultBox.style.backgroundColor = evalData.badgeClass === 'success' ? 'var(--accent-success-bg)' :
                                            evalData.badgeClass === 'warning' ? 'var(--accent-warning-bg)' : 'var(--accent-danger-bg)';
          resultBox.style.border = '1px solid ' + (evalData.badgeClass === 'success' ? 'var(--sage-green)' :
                                                    evalData.badgeClass === 'warning' ? 'var(--accent-warning)' : 'var(--accent-danger)');
          resultBox.innerHTML = `
            <div style="font-size:16px;font-weight:800;margin-bottom:6px;">${decisionEmoji} ${evalData.decision}</div>
            <p style="font-size:13px;line-height:1.5;color:var(--text-primary);">${evalData.explanation}</p>
            <div style="font-size:12px;margin-top:8px;font-weight:600;color:var(--text-secondary);">💡 ${evalData.recommendation}</div>
          `;
        }
      } catch (err) {
        if (window.showToast) showToast(err.message || 'Could not check affordability.', 'danger');
      }
    });
  }
}

function loadNotifications() {
  API.get('/notifications').then(res => {
    if (!res || !res.data) return;
    const notifications = res.data;
    const unread = notifications.filter(n => !n.isRead).length;

    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.style.display = unread > 0 ? 'block' : 'none';
      badge.textContent = unread;
    }

    const list = document.getElementById('notif-list');
    if (list) {
      if (notifications.length === 0) {
        list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;">No notifications</div>`;
      } else {
        list.innerHTML = notifications.slice(0, 8).map(n => `
          <div class="dropdown-item ${n.isRead ? '' : 'font-weight:600'}" style="${!n.isRead ? 'background:var(--accent-info-bg);' : ''}">
            <div style="font-size:13px;font-weight:${n.isRead ? '400' : '600'};">${escapeHTML(n.message || n.title)}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${formatDate(n.createdAt)}</div>
          </div>
        `).join('');
      }
    }
  }).catch(() => {});
}

function setupNotificationDropdown() {
  const btn = document.getElementById('notif-dropdown-btn');
  const menu = document.getElementById('notif-dropdown-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('active');
    if (menu.classList.contains('active')) loadNotifications();
  });

  document.addEventListener('click', () => menu.classList.remove('active'));
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
    Scholarship: 'graduation-cap',
    Gift: 'gift',
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

function initDashboard() {
  if (window.requireAuth) requireAuth();
  loadDashboardData();
  setupQuickActionModals();
  setupNotificationDropdown();
  setupMobileMenu();
}

function setupMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      if (backdrop) backdrop.classList.toggle('active');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar?.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

window.loadDashboardData = loadDashboardData;
window.formatCurrency = formatCurrency;
window.formatCurrencyFull = formatCurrencyFull;
window.formatDate = formatDate;
window.escapeHTML = escapeHTML;
