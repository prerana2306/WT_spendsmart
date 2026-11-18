/**
 * SpendSmart Savings Goals Controller
 */

let allGoals = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadGoals();
  setupGoalModals();
});

async function loadGoals() {
  try {
    const res = await API.get('/goals');
    allGoals = res.data || [];
    renderGoalsList(allGoals);
    updateGoalsStats(allGoals);
  } catch (err) {
    console.error('Failed to load goals:', err);
    showToast('Failed to load savings goals.', 'danger');
  }
}

function renderGoalsList(goals) {
  const container = document.getElementById('goals-cards-grid');
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-secondary);">
        <i data-lucide="target" style="width: 44px; height: 44px; opacity: 0.4; margin-bottom: 12px;"></i>
        <h3 style="font-size: 18px; color: var(--text-primary); margin-bottom: 6px;">No Savings Goals Set Yet</h3>
        <p style="font-size: 13.5px; max-width: 400px; margin: 0 auto 16px;">Whether it's a semester trip, a new laptop, or a rainy-day fund, setting a clear target makes saving rewarding.</p>
        <button class="btn btn-primary" onclick="openModal('new-goal-modal')">Create First Goal</button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);

    return `
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <span class="badge" style="background:var(--bg-surface-secondary);color:var(--text-secondary);margin-bottom:6px;">
                ${g.category || 'Personal'}
              </span>
              <h3 style="font-size:17px;font-weight:700;color:var(--text-primary);">${escapeHTML(g.name)}</h3>
            </div>
            ${g.isCompleted ? '<span class="badge badge-success">Achieved! 🎉</span>' : `<span style="font-size:13px;font-weight:700;color:var(--sage-green);">${pct}%</span>`}
          </div>

          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.4;">
            ${escapeHTML(g.description || 'Target savings goal')}
          </p>

          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
            <span style="font-size:22px;font-weight:800;color:var(--text-primary);">${formatCurrency(g.currentAmount)}</span>
            <span style="font-size:13px;color:var(--text-secondary);">Target: ${formatCurrency(g.targetAmount)}</span>
          </div>

          <div class="progress-bar-bg" style="height:10px;margin-bottom:8px;">
            <div class="progress-bar-fill" style="width:${pct}%;"></div>
          </div>

          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:18px;">
            <span>${remaining === 0 ? 'Fully Funded' : `${formatCurrency(remaining)} to go`}</span>
            <span>Target: ${formatDate(g.deadline)}</span>
          </div>
        </div>

        <div style="display:flex;gap:10px;border-top:1px solid var(--border-color);padding-top:14px;">
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="openContributionModal('${g._id}')">
            <i data-lucide="plus-circle"></i> Add Funds
          </button>
          <button class="btn btn-sm btn-outline btn-icon" onclick="deleteGoal('${g._id}')" title="Delete Goal">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function updateGoalsStats(goals) {
  let totalSaved = 0;
  let totalTarget = 0;
  let completedCount = 0;

  goals.forEach(g => {
    totalSaved += (g.currentAmount || 0);
    totalTarget += (g.targetAmount || 0);
    if (g.isCompleted || g.currentAmount >= g.targetAmount) completedCount++;
  });

  const savedEl = document.getElementById('goals-total-saved');
  const targetEl = document.getElementById('goals-total-target');
  const completedEl = document.getElementById('goals-completed-count');

  if (savedEl) savedEl.textContent = formatCurrency(totalSaved);
  if (targetEl) targetEl.textContent = formatCurrency(totalTarget);
  if (completedEl) completedEl.textContent = `${completedCount} of ${goals.length} Goals`;
}

function setupGoalModals() {
  // New Goal Form
  const newGoalForm = document.getElementById('new-goal-form');
  if (newGoalForm) {
    newGoalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('goal-name-input').value;
      const targetAmount = document.getElementById('goal-target-input').value;
      const currentAmount = document.getElementById('goal-current-input').value;
      const deadline = document.getElementById('goal-deadline-input').value;
      const category = document.getElementById('goal-category-select').value;
      const description = document.getElementById('goal-desc-input').value;

      try {
        await API.post('/goals', {
          name,
          targetAmount,
          currentAmount,
          deadline,
          category,
          description,
        });

        showToast('Savings goal created!', 'success');
        closeModal('new-goal-modal');
        newGoalForm.reset();
        await loadGoals();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // Contribution Form
  const contribForm = document.getElementById('contribution-form');
  if (contribForm) {
    contribForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goalId = document.getElementById('contrib-goal-id').value;
      const amount = document.getElementById('contrib-amount-input').value;
      const note = document.getElementById('contrib-note-input').value;

      try {
        await API.post(`/goals/${goalId}/contributions`, { amount, note });
        showToast('Contribution recorded successfully!', 'success');
        closeModal('contribution-modal');
        contribForm.reset();
        await loadGoals();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }
}

window.openContributionModal = function (goalId) {
  const goal = allGoals.find(g => g._id === goalId);
  if (!goal) return;

  document.getElementById('contrib-goal-id').value = goal._id;
  document.getElementById('contrib-goal-title').textContent = `Add Savings to '${goal.name}'`;
  openModal('contribution-modal');
};

window.deleteGoal = async function (goalId) {
  if (!confirm('Are you sure you want to delete this savings goal?')) return;
  try {
    await API.delete(`/goals/${goalId}`);
    showToast('Savings goal removed.', 'info');
    await loadGoals();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

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
