/**
 * SpendSmart Financial Calendar Controller
 */

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-12
let calendarDayMap = {};
let allReminders = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadCalendar(currentYear, currentMonth);
  setupCalendarControls();
  setupReminderModal();
});

async function loadCalendar(year, month) {
  try {
    const res = await API.get('/calendar', { year, month });
    if (!res.success) return;

    calendarDayMap = res.data.dayMap || {};
    allReminders = res.data.reminders || [];

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById('current-month-display').textContent = `${monthNames[month - 1]} ${year}`;

    renderCalendarGrid(year, month, calendarDayMap);
    renderRemindersSidebar(allReminders);
  } catch (err) {
    console.error('Failed to load calendar:', err);
    showToast('Failed to load calendar.', 'danger');
  }
}

function renderCalendarGrid(year, month, dayMap) {
  const container = document.getElementById('calendar-days-grid');
  if (!container) return;

  container.innerHTML = '';

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-num">${d}</span>`;
    container.appendChild(cell);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = dayMap[dateStr] || { totalIncome: 0, totalExpenses: 0, transactions: [], reminders: [] };

    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';
    if (isCurrentMonth && d === todayDate) {
      cell.classList.add('today');
    }

    let indicators = '';
    if (dayData.totalIncome > 0) {
      indicators += `<span class="cal-summary-tag income">+${formatCurrency(dayData.totalIncome)}</span>`;
    }
    if (dayData.totalExpenses > 0) {
      indicators += `<span class="cal-summary-tag expense">-${formatCurrency(dayData.totalExpenses)}</span>`;
    }
    if (dayData.reminders.length > 0) {
      indicators += `<span class="cal-summary-tag bill">${dayData.reminders.length} Due</span>`;
    }

    cell.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="cal-day-num">${d}</span>
        <div class="cal-event-indicators">
          ${dayData.totalIncome > 0 ? '<span class="cal-dot income"></span>' : ''}
          ${dayData.totalExpenses > 0 ? '<span class="cal-dot expense"></span>' : ''}
          ${dayData.reminders.length > 0 ? '<span class="cal-dot bill"></span>' : ''}
        </div>
      </div>
      <div>${indicators}</div>
    `;

    cell.addEventListener('click', () => openDayDetailsModal(dateStr, dayData));
    container.appendChild(cell);
  }

  // Next month leading days to complete grid (42 cells standard)
  const totalRendered = firstDayOfWeek + daysInMonth;
  const remainingCells = 42 - totalRendered;
  if (remainingCells > 0 && remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-num">${d}</span>`;
      container.appendChild(cell);
    }
  }
}

function renderRemindersSidebar(reminders) {
  const container = document.getElementById('calendar-reminders-list');
  if (!container) return;

  if (reminders.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">No reminders set for this month.</div>`;
    return;
  }

  container.innerHTML = reminders.map(r => `
    <div style="padding:12px;background:var(--bg-surface-secondary);border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:600;font-size:13.5px;color:var(--text-primary);">${escapeHTML(r.title)}</div>
        <div style="font-size:11.5px;color:var(--text-secondary);">
          Due: ${formatDate(r.dueDate)} • <span class="badge ${r.isPaid ? 'badge-success' : 'badge-warning'}">${r.isPaid ? 'Paid' : 'Pending'}</span>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${formatCurrency(r.amount)}</div>
        <button class="btn btn-sm btn-outline" style="height:26px;padding:0 8px;font-size:11px;margin-top:4px;"
          onclick="toggleReminderPaid('${r._id}', ${!r.isPaid})">
          ${r.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
      </div>
    </div>
  `).join('');
}

function openDayDetailsModal(dateStr, data) {
  document.getElementById('day-modal-title').textContent = `Activity on ${formatDate(dateStr)}`;
  const body = document.getElementById('day-modal-body');

  let html = '';

  if (data.transactions.length === 0 && data.reminders.length === 0) {
    html = `<p style="text-align:center;color:var(--text-secondary);padding:20px;">No financial activity or bills scheduled for this date.</p>`;
  } else {
    if (data.transactions.length > 0) {
      html += `<h4 style="font-size:14px;font-weight:700;margin-bottom:8px;">Transactions</h4>`;
      data.transactions.forEach(tx => {
        const isInc = tx.type === 'income';
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13.5px;">
            <div>
              <span style="font-weight:600;">${escapeHTML(tx.description)}</span>
              <span style="font-size:12px;color:var(--text-secondary);margin-left:6px;">(${tx.category})</span>
            </div>
            <span style="font-weight:700;color:${isInc ? 'var(--sage-green)' : 'var(--muted-coral)'};">
              ${isInc ? '+' : '-'}${formatCurrency(tx.amount)}
            </span>
          </div>
        `;
      });
    }

    if (data.reminders.length > 0) {
      html += `<h4 style="font-size:14px;font-weight:700;margin:16px 0 8px;">Due Reminders</h4>`;
      data.reminders.forEach(r => {
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13.5px;">
            <span>${escapeHTML(r.title)}</span>
            <span style="font-weight:700;">${formatCurrency(r.amount)}</span>
          </div>
        `;
      });
    }
  }

  body.innerHTML = html;
  openModal('day-details-modal');
}

function setupCalendarControls() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      loadCalendar(currentYear, currentMonth);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      loadCalendar(currentYear, currentMonth);
    });
  }
}

function setupReminderModal() {
  const form = document.getElementById('new-reminder-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('reminder-title-input').value;
    const amount = document.getElementById('reminder-amount-input').value;
    const dueDate = document.getElementById('reminder-date-input').value;
    const type = document.getElementById('reminder-type-input').value;
    const recurringFrequency = document.getElementById('reminder-frequency-input').value;
    const notes = document.getElementById('reminder-notes-input').value;

    try {
      await API.post('/calendar/reminders', {
        title,
        amount,
        dueDate,
        type,
        recurringFrequency,
        notes,
      });

      showToast('Reminder added successfully!', 'success');
      closeModal('new-reminder-modal');
      form.reset();
      await loadCalendar(currentYear, currentMonth);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

window.toggleReminderPaid = async function (id, isPaid) {
  try {
    await API.put(`/calendar/reminders/${id}`, { isPaid });
    showToast(`Reminder marked as ${isPaid ? 'paid' : 'unpaid'}!`, 'success');
    await loadCalendar(currentYear, currentMonth);
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
