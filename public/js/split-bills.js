/**
 * SpendSmart Split Bill with Friends Controller
 */

let userGroups = [];
let activeGroup = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadGroups();
  setupGroupModals();
});

async function loadGroups() {
  try {
    const res = await API.get('/splits/groups');
    userGroups = res.data || [];
    renderGroupSelector(userGroups);

    if (userGroups.length > 0) {
      await selectGroup(userGroups[0]._id);
    } else {
      renderEmptyGroupState();
    }
  } catch (err) {
    console.error('Failed to load groups:', err);
    showToast('Failed to load split bill groups.', 'danger');
  }
}

function renderGroupSelector(groups) {
  const container = document.getElementById('group-list-nav');
  if (!container) return;

  container.innerHTML = groups.map(g => `
    <button class="action-pill-btn ${activeGroup && activeGroup._id === g._id ? 'primary' : ''}"
      onclick="selectGroup('${g._id}')">
      <i data-lucide="users"></i> ${escapeHTML(g.name)}
    </button>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

window.selectGroup = async function (groupId) {
  try {
    const res = await API.get(`/splits/groups/${groupId}`);
    activeGroup = res.data.group;
    renderGroupSelector(userGroups);
    renderGroupDetails(res.data);
  } catch (err) {
    showToast('Failed to load group details.', 'danger');
  }
};

function renderGroupDetails(data) {
  const { group, expenses, settlements, balances } = data;

  document.getElementById('active-group-title').textContent = group.name;
  document.getElementById('active-group-desc').textContent = group.description || `${group.members.length} members`;
  document.getElementById('active-group-members-count').textContent = `${group.members.length} Friends`;

  // Render Balances Summary
  const balanceContainer = document.getElementById('group-balances-container');
  if (balanceContainer) {
    balanceContainer.innerHTML = balances.map(b => {
      const isPositive = b.netBalance > 0;
      const isZero = b.netBalance === 0;

      return `
        <div class="card" style="padding:14px;background:var(--bg-surface-secondary);border:none;">
          <div style="font-weight:700;font-size:14px;color:var(--text-primary);margin-bottom:4px;">
            ${escapeHTML(b.name)}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
            Paid: ${formatCurrency(b.totalPaid)} | Share: ${formatCurrency(b.totalOwed)}
          </div>
          <div style="font-size:13.5px;font-weight:700;color:${isZero ? 'var(--text-secondary)' : isPositive ? 'var(--sage-green)' : 'var(--muted-coral)'};">
            ${isZero ? 'Settled Up' : isPositive ? `Gets back ${formatCurrency(b.netBalance)}` : `Owes ${formatCurrency(Math.abs(b.netBalance))}`}
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Group Expenses Table
  const expTbody = document.getElementById('group-expenses-tbody');
  if (expTbody) {
    if (expenses.length === 0) {
      expTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary);">No expenses in this group yet.</td></tr>`;
    } else {
      expTbody.innerHTML = expenses.map(e => `
        <tr>
          <td style="font-size:13px;color:var(--text-secondary);">${formatDate(e.date)}</td>
          <td style="font-weight:600;color:var(--text-primary);">${escapeHTML(e.title)}</td>
          <td style="font-size:13px;color:var(--text-secondary);">Paid by <strong>${escapeHTML(e.paidBy.name)}</strong></td>
          <td><span class="badge" style="background:var(--bg-surface-secondary);">${e.splitType} split</span></td>
          <td style="font-weight:700;color:var(--text-primary);">${formatCurrency(e.totalAmount)}</td>
        </tr>
      `).join('');
    }
  }

  // Render Settlements History
  const setContainer = document.getElementById('group-settlements-list');
  if (setContainer) {
    if (settlements.length === 0) {
      setContainer.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">No settlements logged yet.</div>`;
    } else {
      setContainer.innerHTML = settlements.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-surface-secondary);border-radius:10px;margin-bottom:8px;">
          <div>
            <div style="font-size:13px;font-weight:600;">${escapeHTML(s.fromName)} paid ${escapeHTML(s.toName)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${formatDate(s.settledAt)} ${s.notes ? `• ${escapeHTML(s.notes)}` : ''}</div>
          </div>
          <div style="font-weight:700;color:var(--sage-green);">${formatCurrency(s.amount)}</div>
        </div>
      `).join('');
    }
  }
}

function renderEmptyGroupState() {
  const container = document.getElementById('split-bill-view-area');
  if (container) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <i data-lucide="users" style="width:48px;height:48px;opacity:0.4;margin-bottom:12px;"></i>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:8px;">No Split Groups Yet</h3>
        <p style="font-size:14px;color:var(--text-secondary);max-width:400px;margin:0 auto 20px;">
          Create a group for your hostel room, weekend outing, or cafeteria gang to split expenses easily.
        </p>
        <button class="btn btn-primary" onclick="openModal('new-group-modal')">Create Your First Group</button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function setupGroupModals() {
  // Create Group Form
  const newGroupForm = document.getElementById('new-group-form');
  if (newGroupForm) {
    newGroupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name-input').value;
      const description = document.getElementById('group-desc-input').value;
      const rawFriends = document.getElementById('group-members-input').value;

      const members = rawFriends
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0)
        .map(f => ({ name: f }));

      try {
        await API.post('/splits/groups', { name, description, members });
        showToast('Group created successfully!', 'success');
        closeModal('new-group-modal');
        newGroupForm.reset();
        await loadGroups();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // Add Shared Expense Form
  const addExpenseForm = document.getElementById('add-split-expense-form');
  if (addExpenseForm) {
    addExpenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeGroup) return;

      const title = document.getElementById('split-exp-title').value;
      const totalAmount = document.getElementById('split-exp-amount').value;
      const paidByMemberId = document.getElementById('split-exp-payer').value;
      const splitType = document.getElementById('split-exp-type').value;

      try {
        await API.post(`/splits/groups/${activeGroup._id}/expenses`, {
          title,
          totalAmount,
          paidByMemberId,
          splitType,
        });

        showToast('Shared expense added!', 'success');
        closeModal('add-split-expense-modal');
        addExpenseForm.reset();
        await selectGroup(activeGroup._id);
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // Settlement Form
  const settleForm = document.getElementById('record-settlement-form');
  if (settleForm) {
    settleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeGroup) return;

      const fromMemberId = document.getElementById('settle-from-member').value;
      const toMemberId = document.getElementById('settle-to-member').value;
      const amount = document.getElementById('settle-amount-input').value;
      const notes = document.getElementById('settle-notes-input').value;

      if (fromMemberId === toMemberId) {
        return showToast('Payer and receiver cannot be the same member.', 'warning');
      }

      try {
        await API.post('/splits/settlements', {
          groupId: activeGroup._id,
          fromMemberId,
          toMemberId,
          amount,
          notes,
        });

        showToast('Settlement recorded!', 'success');
        closeModal('record-settlement-modal');
        settleForm.reset();
        await selectGroup(activeGroup._id);
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }
}

window.openAddExpenseModal = function () {
  if (!activeGroup) return showToast('Please select or create a group first.', 'warning');

  const payerSelect = document.getElementById('split-exp-payer');
  if (payerSelect) {
    payerSelect.innerHTML = activeGroup.members.map(m => `
      <option value="${m._id}">${escapeHTML(m.name)}</option>
    `).join('');
  }

  openModal('add-split-expense-modal');
};

window.openSettlementModal = function () {
  if (!activeGroup) return showToast('Please select or create a group first.', 'warning');

  const fromSel = document.getElementById('settle-from-member');
  const toSel = document.getElementById('settle-to-member');

  if (fromSel && toSel) {
    const opts = activeGroup.members.map(m => `
      <option value="${m._id}">${escapeHTML(m.name)}</option>
    `).join('');

    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
  }

  openModal('record-settlement-modal');
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
