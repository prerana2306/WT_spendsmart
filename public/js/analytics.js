/**
 * SpendSmart Insights & Analytics Controller
 */

let trendsChartInstance = null;
let needsWantsChartInstance = null;
let categoryBarChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadAnalytics();
});

async function loadAnalytics() {
  await Promise.all([
    loadHealthScoreSection(),
    loadNeedsVsWantsSection(),
    loadAnomaliesSection(),
    loadSpendingTrends(),
  ]);
}

// 1. Financial Health Score Pillar Breakdown
async function loadHealthScoreSection() {
  try {
    const res = await API.get('/smart/health-score');
    if (!res.success) return;

    const h = res.data;
    document.getElementById('analytics-health-score').textContent = h.score;
    document.getElementById('analytics-health-category').textContent = h.category;

    const compContainer = document.getElementById('health-components-list');
    if (compContainer) {
      compContainer.innerHTML = Object.values(h.components).map(c => {
        const pct = Math.round((c.score / c.max) * 100);
        return `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px;">
              <span>${c.title} (${c.details})</span>
              <span>${c.score} / ${c.max} pts</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const tipsContainer = document.getElementById('health-suggestions-list');
    if (tipsContainer) {
      tipsContainer.innerHTML = h.suggestions.map(s => `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:13px;color:var(--text-secondary);">
          <span style="color:var(--sage-green);font-weight:bold;">•</span>
          <span>${s}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load health score:', err);
  }
}

// 2. Needs vs Wants Analyzer
async function loadNeedsVsWantsSection() {
  try {
    const res = await API.get('/smart/needs-wants');
    if (!res.success) return;

    const nw = res.data.currentMonth;
    document.getElementById('needs-percentage-label').textContent = `${nw.needsPercentage}%`;
    document.getElementById('wants-percentage-label').textContent = `${nw.wantsPercentage}%`;
    document.getElementById('needs-amount-label').textContent = formatCurrency(nw.needsTotal);
    document.getElementById('wants-amount-label').textContent = formatCurrency(nw.wantsTotal);

    // Render Doughnut Chart
    const ctx = document.getElementById('analyticsNeedsWantsChart');
    if (ctx && typeof Chart !== 'undefined') {
      if (needsWantsChartInstance) needsWantsChartInstance.destroy();

      needsWantsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Needs (Essential)', 'Wants (Discretionary)'],
          datasets: [{
            data: [nw.needsTotal || 1, nw.wantsTotal || 0],
            backgroundColor: ['#6B9B7B', '#CE8276'],
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
                font: { family: "'Inter', sans-serif", size: 12 },
                color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
              },
            },
          },
          cutout: '65%',
        },
      });
    }

    // Recommendations list
    const recContainer = document.getElementById('needs-wants-recommendations');
    if (recContainer && res.data.recommendations) {
      recContainer.innerHTML = res.data.recommendations.map(r => `
        <div class="card" style="padding:14px;background:var(--bg-surface-secondary);border:none;margin-bottom:10px;">
          <h4 style="font-size:14px;font-weight:700;margin-bottom:4px;">${r.title}</h4>
          <p style="font-size:13px;color:var(--text-secondary);">${r.description}</p>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load needs vs wants:', err);
  }
}

// 3. Expense Anomaly Detection
async function loadAnomaliesSection() {
  try {
    const res = await API.get('/smart/anomalies');
    const container = document.getElementById('anomalies-list-container');
    if (!container) return;

    if (!res.data.hasSufficientData) {
      container.innerHTML = `
        <div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13.5px;">
          <i data-lucide="info" style="width:32px;height:32px;opacity:0.5;margin-bottom:6px;"></i>
          <p>${res.data.message}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (res.data.anomalies.length === 0) {
      container.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13.5px;">
          <i data-lucide="shield-check" style="width:36px;height:36px;color:var(--sage-green);margin-bottom:6px;"></i>
          <p style="font-weight:600;color:var(--text-primary);">No spending anomalies detected!</p>
          <p style="font-size:12.5px;">Your category expenses align smoothly with your previous month's baseline.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = res.data.anomalies.map(a => `
      <div class="card" style="border-left: 4px solid var(--muted-coral);padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h4 style="font-size:14.5px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <i data-lucide="alert-triangle" style="width:16px;height:16px;color:var(--muted-coral);"></i>
            ${a.title}
          </h4>
          <span class="badge badge-danger">${a.severity.toUpperCase()}</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">${a.message}</p>
        <div style="font-size:12px;background:var(--bg-surface-secondary);padding:8px 12px;border-radius:8px;color:var(--text-primary);font-weight:500;">
          💡 <strong>Tip:</strong> ${a.recommendation}
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load anomalies:', err);
  }
}

// 4. Spending Trends Chart
async function loadSpendingTrends() {
  const ctx = document.getElementById('analyticsTrendsChart');
  if (!ctx || typeof Chart === 'undefined') return;

  try {
    const res = await API.get('/transactions', { limit: 100 });
    const txs = res.data || [];

    // Aggregate by category
    const catMap = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(catMap);
    const dataValues = Object.values(catMap);

    if (trendsChartInstance) trendsChartInstance.destroy();

    trendsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Spent (₹)',
          data: dataValues,
          backgroundColor: '#6B9B7B',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => '₹' + v.toLocaleString(),
              color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
            },
            grid: {
              color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#394A3E' : '#E8E8DE',
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
            },
          },
        },
      },
    });
  } catch (err) {
    console.error('Failed to render spending trends:', err);
  }
}

// 5. Financial Report Print / PDF Generator
window.printFinancialReport = function () {
  window.print();
};
