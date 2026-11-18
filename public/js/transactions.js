/**
 * SpendSmart Transactions Controller
 */

let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadTransactions();
  setupTransactionFilters();
  setupTransactionForm();
});

async function loadTransactions() {
  const search = document.getElementById('filter-search')?.value || '';
  const category = document.getElementById('filter-category')?.value || '';
  const type = document.getElementById('filter-type')?.value || '';
  const classification = document.getElementById('filter-classification')?.value || '';
  const paymentMethod = document.getElementById('filter-payment')?.value || '';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';

  const params = {};
  if (search) params.search = search;
  if (category) params.category = category;
  if (type) params.type = type;
  if (classification) params.classification = classification;
  if (paymentMethod) params.paymentMethod = paymentMethod;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  try {
    const res = await API.get('/transactions', params);
    currentTransactions = res.data || [];
    renderTransactionsTable(currentTransactions);
    updateFilterSummary(currentTransactions);
  } catch (err) {
    console.error('Error loading transactions:', err);
    showToast('Failed to load transactions.', 'danger');
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary);">
          <i data-lucide="inbox" style="width:36px;height:36px;opacity:0.4;margin-bottom:8px;"></i>
          <p>No transactions found matching your criteria.</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const sign = isIncome ? '+' : '-';
    return `
      <tr>
        <td style="font-size:13px;color:var(--text-secondary);">${formatDate(tx.date)}</td>
        <td style="font-weight:600;font-size:14px;color:var(--text-primary);">${escapeHTML(tx.description)}</td>
        <td><span class="badge" style="background:var(--bg-surface-secondary);color:var(--text-primary);">${tx.category}</span></td>
        <td>
          <span class="badge ${tx.classification === 'need' ? 'badge-need' : 'badge-want'}">
            ${tx.classification || 'need'}
          </span>
        </td>
        <td style="font-size:13px;color:var(--text-secondary);">${tx.paymentMethod}</td>
        <td style="font-weight:700;font-size:14.5px;color:${isIncome ? 'var(--sage-green)' : 'var(--muted-coral)'};">
          ${sign}${formatCurrency(tx.amount)}
        </td>
        <td style="font-size:12px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHTML(tx.notes || '-')}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline btn-icon" onclick="editTransaction('${tx._id}')" title="Edit">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="deleteTransaction('${tx._id}')" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function updateFilterSummary(transactions) {
  let income = 0;
  let expenses = 0;

  transactions.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else expenses += t.amount;
  });

  const incomeEl = document.getElementById('summary-filtered-income');
  const expenseEl = document.getElementById('summary-filtered-expense');
  const balanceEl = document.getElementById('summary-filtered-balance');

  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (expenseEl) expenseEl.textContent = formatCurrency(expenses);
  if (balanceEl) balanceEl.textContent = formatCurrency(income - expenses);
}

function setupTransactionFilters() {
  const inputs = ['filter-search', 'filter-category', 'filter-type', 'filter-classification', 'filter-payment', 'filter-start-date', 'filter-end-date'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', debounce(loadTransactions, 300));
      el.addEventListener('change', loadTransactions);
    }
  });

  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      loadTransactions();
    });
  }

  // Export CSV button
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const blob = await API.get('/transactions/export/csv');
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SpendSmart_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Transactions exported as CSV.', 'success');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'danger');
      }
    });
  }
}

function setupTransactionForm() {
  const form = document.getElementById('transaction-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-edit-id')?.value;
    const type = document.getElementById('tx-input-type').value;
    const amount = document.getElementById('tx-input-amount').value;
    const description = document.getElementById('tx-input-desc').value;
    const category = document.getElementById('tx-input-category').value;
    const classification = document.getElementById('tx-input-classification').value;
    const paymentMethod = document.getElementById('tx-input-payment').value;
    const date = document.getElementById('tx-input-date').value;
    const notes = document.getElementById('tx-input-notes').value;

    const payload = {
      type,
      amount,
      description,
      category,
      classification,
      paymentMethod,
      date,
      notes,
    };

    try {
      if (id) {
        await API.put(`/transactions/${id}`, payload);
        showToast('Transaction updated!', 'success');
      } else {
        await API.post('/transactions', payload);
        showToast('Transaction logged!', 'success');
      }

      closeModal('transaction-modal');
      form.reset();
      if (document.getElementById('tx-edit-id')) document.getElementById('tx-edit-id').value = '';
      await loadTransactions();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

window.editTransaction = function (id) {
  const tx = currentTransactions.find(t => t._id === id);
  if (!tx) return;

  document.getElementById('tx-edit-id').value = tx._id;
  document.getElementById('tx-input-type').value = tx.type;
  document.getElementById('tx-input-amount').value = tx.amount;
  document.getElementById('tx-input-desc').value = tx.description;
  document.getElementById('tx-input-category').value = tx.category;
  document.getElementById('tx-input-classification').value = tx.classification || 'need';
  document.getElementById('tx-input-payment').value = tx.paymentMethod;
  document.getElementById('tx-input-date').value = new Date(tx.date).toISOString().split('T')[0];
  document.getElementById('tx-input-notes').value = tx.notes || '';

  document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
  openModal('transaction-modal');
};

window.deleteTransaction = async function (id) {
  if (!confirm('Are you sure you want to delete this transaction record?')) return;
  try {
    await API.delete(`/transactions/${id}`);
    showToast('Transaction deleted.', 'info');
    await loadTransactions();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

window.openNewTransactionModal = function () {
  const form = document.getElementById('transaction-form');
  if (form) form.reset();
  if (document.getElementById('tx-edit-id')) document.getElementById('tx-edit-id').value = '';
  document.getElementById('tx-input-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
  openModal('transaction-modal');
};

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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
