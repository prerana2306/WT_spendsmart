/**
 * SpendSmart Budgets Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadBudgetData();
  setupBudgetModal();
});

async function loadBudgetData() {
  try {
    const res = await API.get('/budgets/current');
    if (!res.success) return;

    const data = res.data;

    // Overall Budget Display
    document.getElementById('overall-limit-display').textContent = formatCurrency(data.overallLimit);
    document.getElementById('overall-spent-display').textContent = formatCurrency(data.totalSpent);
    document.getElementById('overall-remaining-display').textContent = formatCurrency(data.remainingOverall);
    document.getElementById('overall-utilization-display').textContent = `${data.overallPercentage}%`;

    const fill = document.getElementById('overall-progress-fill');
    if (fill) {
      fill.style.width = `${Math.min(100, data.overallPercentage)}%`;
      fill.className = 'progress-bar-fill';
      if (data.isOverBudget) fill.classList.add('danger');
      else if (data.overallPercentage > 75) fill.classList.add('warning');
    }

    // Category Budgets Grid
    renderCategoryBudgets(data.categoryBudgets);
  } catch (err) {
    console.error('Failed to load budget data:', err);
    showToast('Failed to load budget records.', 'danger');
  }
}

function renderCategoryBudgets(categories) {
  const container = document.getElementById('category-budgets-grid');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary);">
        <i data-lucide="sliders" style="width:36px;height:36px;opacity:0.4;margin-bottom:8px;"></i>
        <p>No category budgets configured for this month.</p>
        <button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="openBudgetModal()">Configure Category Caps</button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = categories.map(c => `
    <div class="card" style="padding:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h4 style="font-size:15px;font-weight:700;">${c.category}</h4>
        <span class="badge ${c.isOverBudget ? 'badge-danger' : c.percentage > 75 ? 'badge-warning' : 'badge-success'}">
          ${c.isOverBudget ? 'Over Budget!' : `${c.percentage}%`}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
        <span>Spent: ${formatCurrency(c.spent)}</span>
        <span>Limit: ${formatCurrency(c.limit)}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${c.isOverBudget ? 'danger' : c.percentage > 75 ? 'warning' : ''}" style="width:${c.percentage}%;"></div>
      </div>
      <div style="font-size:11.5px;color:var(--text-secondary);margin-top:8px;">
        ${c.isOverBudget ? `Exceeded by ${formatCurrency(c.spent - c.limit)}` : `${formatCurrency(c.remaining)} remaining`}
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

function setupBudgetModal() {
  const form = document.getElementById('budget-config-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const overallLimit = document.getElementById('budget-input-overall').value;

    const categories = [
      { category: 'Food', limit: parseFloat(document.getElementById('b-food')?.value) || 0 },
      { category: 'Hostel', limit: parseFloat(document.getElementById('b-hostel')?.value) || 0 },
      { category: 'Transport', limit: parseFloat(document.getElementById('b-transport')?.value) || 0 },
      { category: 'Education', limit: parseFloat(document.getElementById('b-education')?.value) || 0 },
      { category: 'Shopping', limit: parseFloat(document.getElementById('b-shopping')?.value) || 0 },
      { category: 'Entertainment', limit: parseFloat(document.getElementById('b-entertainment')?.value) || 0 },
      { category: 'Bills', limit: parseFloat(document.getElementById('b-bills')?.value) || 0 },
      { category: 'Healthcare', limit: parseFloat(document.getElementById('b-healthcare')?.value) || 0 },
    ].filter(c => c.limit > 0);

    try {
      await API.post('/budgets', {
        overallLimit: parseFloat(overallLimit),
        categoryBudgets: categories,
      });

      showToast('Budget preferences updated!', 'success');
      closeModal('budget-modal');
      await loadBudgetData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

window.openBudgetModal = async function () {
  try {
    const res = await API.get('/budgets/current');
    if (res.data) {
      document.getElementById('budget-input-overall').value = res.data.overallLimit || '';
      if (res.data.categoryBudgets) {
        res.data.categoryBudgets.forEach(cb => {
          const id = `b-${cb.category.toLowerCase()}`;
          const input = document.getElementById(id);
          if (input) input.value = cb.limit;
        });
      }
    }
  } catch (e) {}
  openModal('budget-modal');
};
