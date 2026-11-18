/**
 * SpendSmart Challenges & Badges Controller
 */

let allChallenges = [];
let userProgressList = [];
let userBadges = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadChallenges();
  setupCheckInModal();
});

async function loadChallenges() {
  try {
    const res = await API.get('/challenges');
    if (!res.success) return;

    allChallenges = res.data.challenges || [];
    userProgressList = res.data.userProgress || [];
    userBadges = res.data.userBadges || [];

    renderActiveChallenges(userProgressList);
    renderAvailableChallenges(allChallenges, userProgressList);
    renderBadgesShowcase(userBadges);
  } catch (err) {
    console.error('Failed to load challenges:', err);
    showToast('Failed to load challenges.', 'danger');
  }
}

function renderActiveChallenges(progressList) {
  const container = document.getElementById('active-challenges-grid');
  if (!container) return;

  const active = progressList.filter(p => p.status === 'active');
  if (active.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary);">
        <i data-lucide="award" style="width:40px;height:40px;opacity:0.4;margin-bottom:8px;"></i>
        <h4 style="font-size:16px;color:var(--text-primary);margin-bottom:4px;">No Active Challenges Right Now</h4>
        <p style="font-size:13px;">Pick a challenge below to build winning student money habits!</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = active.map(p => {
    const c = p.challenge;
    const checkInsCount = p.checkIns.length;
    const targetDays = c.durationDays || 7;
    const pct = Math.min(100, Math.round((checkInsCount / targetDays) * 100));
    const todayStr = new Date().toISOString().split('T')[0];
    const checkedToday = p.checkIns.some(ci => ci.date === todayStr);

    return `
      <div class="card" style="border-top:4px solid var(--sage-green);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <span class="badge badge-success" style="margin-bottom:6px;">${c.category}</span>
            <h3 style="font-size:16px;font-weight:700;">${c.title}</h3>
          </div>
          <div style="display:flex;align-items:center;gap:4px;color:#D97706;font-weight:700;font-size:14px;">
            <i data-lucide="flame"></i> ${p.currentStreak}d Streak
          </div>
        </div>

        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.4;">
          ${c.description}
        </p>

        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:6px;">
          <span>Day ${checkInsCount} of ${targetDays}</span>
          <span>${pct}% Complete</span>
        </div>
        <div class="progress-bar-bg" style="height:8px;margin-bottom:16px;">
          <div class="progress-bar-fill" style="width:${pct}%;"></div>
        </div>

        <button class="btn btn-sm ${checkedToday ? 'btn-secondary' : 'btn-primary'} w-full"
          ${checkedToday ? 'disabled' : ''}
          onclick="openCheckInModal('${p._id}', '${c.title}')">
          <i data-lucide="${checkedToday ? 'check' : 'calendar-check'}"></i>
          ${checkedToday ? 'Checked in for Today!' : 'Check In Today'}
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderAvailableChallenges(challenges, progressList) {
  const container = document.getElementById('available-challenges-grid');
  if (!container) return;

  const activeIds = progressList.filter(p => p.status === 'active').map(p => p.challenge?._id || p.challenge);

  container.innerHTML = challenges.map(c => {
    const isJoined = activeIds.includes(c._id);
    return `
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="badge" style="background:var(--bg-surface-secondary);color:var(--text-primary);">${c.category}</span>
            <span style="font-size:12px;color:var(--text-secondary);">${c.durationDays} Days</span>
          </div>
          <h4 style="font-size:16px;font-weight:700;margin-bottom:6px;">${c.title}</h4>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.4;">
            ${c.description}
          </p>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">
            Badge: <strong>${c.badgeTier}</strong>
          </div>
        </div>
        <button class="btn btn-sm ${isJoined ? 'btn-outline' : 'btn-primary'} w-full"
          ${isJoined ? 'disabled' : ''}
          onclick="joinChallenge('${c._id}')">
          ${isJoined ? 'Currently Active' : 'Accept Challenge'}
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderBadgesShowcase(badges) {
  const container = document.getElementById('badges-grid-container');
  if (!container) return;

  const badgeTemplates = [
    { code: 'no-spend-weekend', tier: 'Bronze Saver', title: 'Weekend Discipline', desc: 'Zero non-essential spending for 48 hours' },
    { code: 'save-500-week', tier: 'Bronze Saver', title: '500 Saver', desc: 'Saved ₹500 in one week' },
    { code: 'saving-streak-7', tier: 'Silver Saver', title: 'Streak Master', desc: '7-day daily spending adherence' },
    { code: 'avoid-food-delivery', tier: 'Silver Saver', title: 'Mess Champ', desc: 'Avoided delivery apps for 5 days' },
    { code: 'save-100-daily', tier: 'Gold Saver', title: 'Daily Compounder', desc: '10 consecutive days of ₹100 micro-savings' },
    { code: 'money-master-30', tier: 'Money Master', title: 'Fintech Master', desc: 'Full month within monthly budget' },
  ];

  const unlockedCodes = badges.map(b => b.code);

  container.innerHTML = badgeTemplates.map(bt => {
    const isUnlocked = unlockedCodes.includes(bt.code);
    return `
      <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="badge-icon-wrap">
          <i data-lucide="${isUnlocked ? 'trophy' : 'lock'}"></i>
        </div>
        <div style="font-size:11px;font-weight:700;color:${isUnlocked ? 'var(--pine-green)' : 'var(--text-muted)'};text-transform:uppercase;margin-bottom:2px;">
          ${bt.tier}
        </div>
        <h4 style="font-size:15px;font-weight:700;margin-bottom:4px;">${bt.title}</h4>
        <p style="font-size:12px;color:var(--text-secondary);line-height:1.3;">
          ${bt.desc}
        </p>
        <span class="badge ${isUnlocked ? 'badge-success' : ''}" style="margin-top:10px;font-size:11px;">
          ${isUnlocked ? 'Unlocked 🏆' : 'Locked'}
        </span>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

window.joinChallenge = async function (challengeId) {
  try {
    const res = await API.post('/challenges/join', { challengeId });
    showToast(res.message, 'success');
    await loadChallenges();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

function setupCheckInModal() {
  const form = document.getElementById('challenge-checkin-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const progressId = document.getElementById('checkin-progress-id').value;
    const savedAmount = document.getElementById('checkin-saved-amount').value;
    const note = document.getElementById('checkin-note').value;

    try {
      const res = await API.post('/challenges/check-in', {
        progressId,
        savedAmount,
        note,
      });

      showToast(res.message, 'success');
      closeModal('checkin-modal');
      form.reset();
      await loadChallenges();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

window.openCheckInModal = function (progressId, title) {
  document.getElementById('checkin-progress-id').value = progressId;
  document.getElementById('checkin-modal-title').textContent = `Daily Check-In: ${title}`;
  openModal('checkin-modal');
};
