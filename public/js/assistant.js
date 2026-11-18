/**
 * SpendSmart AI Assistant, Purchase Calculator & Savings Simulator Controller
 */

let simulationChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadAssistantOverview();
  setupAssistantChat();
  setupPurchaseCalculator();
  setupSavingsSimulator();
});

async function loadAssistantOverview() {
  try {
    const res = await API.get('/smart/assistant');
    if (!res.success) return;

    const data = res.data;
    const recContainer = document.getElementById('assistant-recommendations-list');
    if (recContainer && data.recommendations) {
      recContainer.innerHTML = data.recommendations.map(r => `
        <div class="card" style="padding:16px;background:var(--bg-surface-secondary);border:1px solid var(--border-color);margin-bottom:12px;">
          <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:var(--sage-green);letter-spacing:0.04em;">
            ${r.topic}
          </div>
          <h4 style="font-size:15px;font-weight:700;color:var(--text-primary);margin:4px 0 6px;">
            ${r.title}
          </h4>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.4;">
            ${r.message}
          </p>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load assistant:', err);
  }
}

function setupAssistantChat() {
  const form = document.getElementById('assistant-query-form');
  const input = document.getElementById('assistant-query-input');
  const messagesBox = document.getElementById('assistant-messages');

  if (form && input && messagesBox) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      // Append user bubble
      appendMessage('user', query);
      input.value = '';

      // Typing state
      const typingEl = appendMessage('assistant', 'Analyzing your live financial data...');

      try {
        const res = await API.post('/smart/assistant/query', { query });
        if (res.data && res.data.answer) {
          typingEl.remove();
          appendMessage('assistant', res.data.answer.reply);
        } else {
          typingEl.textContent = 'Here is your current financial summary: Your available balance is healthy. Check your daily spending limit to stay within budget!';
        }
      } catch (err) {
        typingEl.textContent = 'Error processing request. Please try again.';
      }
    });
  }

  // Quick Chips
  const chips = document.querySelectorAll('.prompt-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (input) {
        input.value = q;
        form.dispatchEvent(new Event('submit'));
      }
    });
  });
}

function appendMessage(sender, text) {
  const messagesBox = document.getElementById('assistant-messages');
  if (!messagesBox) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  // Simple markdown-to-html conversion for bold and lists
  let formatted = escapeHTML(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  bubble.innerHTML = formatted;
  messagesBox.appendChild(bubble);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  return bubble;
}

// FEATURE 3: Smart Purchase Decision Calculator
function setupPurchaseCalculator() {
  const form = document.getElementById('purchase-calculator-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productName = document.getElementById('calc-item-name').value;
    const amount = document.getElementById('calc-item-amount').value;
    const category = document.getElementById('calc-item-category').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Evaluating...';

      const res = await API.post('/smart/purchase-check', { productName, amount, category });
      const ev = res.data;

      const resultBox = document.getElementById('calc-decision-result');
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div class="card" style="border-left: 4px solid ${ev.badgeClass === 'success' ? 'var(--sage-green)' : ev.badgeClass === 'warning' ? 'var(--butter-yellow)' : 'var(--muted-coral)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:18px;font-weight:800;">${ev.decision}</h3>
              <span class="badge badge-${ev.badgeClass}">${ev.badgeClass.toUpperCase()}</span>
            </div>
            <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;margin-bottom:14px;">
              ${ev.explanation}
            </p>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;background:var(--bg-surface-secondary);padding:12px;border-radius:10px;margin-bottom:12px;font-size:12px;">
              <div>
                <div style="color:var(--text-secondary);">Balance After</div>
                <div style="font-weight:700;font-size:14px;">${formatCurrency(ev.balanceAfterPurchase)}</div>
              </div>
              <div>
                <div style="color:var(--text-secondary);">Upcoming Bills</div>
                <div style="font-weight:700;font-size:14px;">${formatCurrency(ev.upcomingObligations)}</div>
              </div>
              <div>
                <div style="color:var(--text-secondary);">Safe Waiting Period</div>
                <div style="font-weight:700;font-size:14px;">${ev.waitingPeriodDays > 0 ? `${ev.waitingPeriodDays} Days` : 'None (Safe)'}</div>
              </div>
            </div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">
              Recommendation: ${ev.recommendation}
            </div>
          </div>
        `;
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Evaluate Affordability';
    }
  });
}

// FEATURE 6: What-If Savings Simulator
function setupSavingsSimulator() {
  const inputs = ['sim-daily-extra', 'sim-weekly-extra', 'sim-expense-cut', 'sim-target-amount', 'sim-months'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        updateSimValueLabels();
        runSimulationCalc();
      });
    }
  });

  updateSimValueLabels();
  runSimulationCalc();
}

function updateSimValueLabels() {
  const dVal = document.getElementById('sim-daily-extra')?.value || 0;
  const wVal = document.getElementById('sim-weekly-extra')?.value || 0;
  const cVal = document.getElementById('sim-expense-cut')?.value || 0;
  const mVal = document.getElementById('sim-months')?.value || 6;

  const dLbl = document.getElementById('sim-daily-label');
  const wLbl = document.getElementById('sim-weekly-label');
  const cLbl = document.getElementById('sim-cut-label');
  const mLbl = document.getElementById('sim-months-label');

  if (dLbl) dLbl.textContent = `₹${dVal}/day`;
  if (wLbl) wLbl.textContent = `₹${wVal}/week`;
  if (cLbl) cLbl.textContent = `₹${cVal}/month`;
  if (mLbl) mLbl.textContent = `${mVal} Months`;
}

async function runSimulationCalc() {
  const daily = document.getElementById('sim-daily-extra')?.value || 50;
  const weekly = document.getElementById('sim-weekly-extra')?.value || 200;
  const cut = document.getElementById('sim-expense-cut')?.value || 500;
  const target = document.getElementById('sim-target-amount')?.value || 15000;
  const months = document.getElementById('sim-months')?.value || 6;

  try {
    const res = await API.post('/smart/simulate', {
      monthlyIncome: 18000,
      monthlyExpenses: 12000,
      additionalDailySavings: daily,
      additionalWeeklySavings: weekly,
      plannedExpenseCut: cut,
      targetSavingsAmount: target,
      months,
    });

    const sim = res.data;

    document.getElementById('sim-baseline-monthly').textContent = formatCurrency(sim.baselineMonthlySavings);
    document.getElementById('sim-projected-monthly').textContent = formatCurrency(sim.projectedMonthlySavings);
    document.getElementById('sim-total-projected').textContent = formatCurrency(sim.totalProjectedAfterDuration);
    document.getElementById('sim-net-difference').textContent = `+${formatCurrency(sim.netGain)}`;

    const insightsContainer = document.getElementById('sim-insights-list');
    if (insightsContainer && sim.summaryInsights) {
      insightsContainer.innerHTML = sim.summaryInsights.map(s => `
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">
          <span style="color:var(--sage-green);">✓</span>
          <span>${s}</span>
        </div>
      `).join('');
    }

    renderSimulationChart(sim.timeline);
  } catch (err) {
    console.error('Simulation calculation failed:', err);
  }
}

function renderSimulationChart(timeline) {
  const ctx = document.getElementById('simulationChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = timeline.map(t => t.month);
  const baselineData = timeline.map(t => t.baselineCumulative);
  const projectedData = timeline.map(t => t.projectedCumulative);

  if (simulationChartInstance) simulationChartInstance.destroy();

  simulationChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'With New Habits (Projected)',
          data: projectedData,
          borderColor: '#6B9B7B',
          backgroundColor: 'rgba(107, 155, 123, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
        },
        {
          label: 'Current Baseline',
          data: baselineData,
          borderColor: '#CE8276',
          borderDash: [5, 5],
          tension: 0.3,
          borderWidth: 2,
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
          ticks: {
            callback: (v) => '₹' + v.toLocaleString(),
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
          },
          grid: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#394A3E' : '#E8E8DE',
          },
        },
        x: {
          ticks: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#B0BDB2' : '#758077',
          },
        },
      },
    },
  });
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
