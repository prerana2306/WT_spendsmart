/**
 * SpendSmart Unified API & Utility Client
 */

const API_BASE = '/api';
const TOKEN_KEY = 'spendsmart_token';
const USER_KEY = 'spendsmart_user';

const API = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  // Core Request Method
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};

    // Don't set Content-Type for FormData (file uploads)
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // If token expired or unauthorized
      if (response.status === 401) {
        this.clearAuth();
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && window.location.pathname !== '/' && !window.location.pathname.includes('index.html')) {
          window.location.href = '/login.html';
        }
        throw new Error('Session expired. Please log in again.');
      }

      // Check if response is blob / file
      const contentType = response.headers.get('content-type');
      if (contentType && (contentType.includes('text/csv') || contentType.includes('application/octet-stream') || contentType.includes('application/pdf'))) {
        return await response.blob();
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'An unexpected error occurred.');
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // Helper HTTP Verbs
  get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams(params).toString();
      url += `?${query}`;
    }
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

// UI Toast Notification System
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'danger' ? 'alert-triangle' : type === 'warning' ? 'alert-circle' : 'info';
  toast.innerHTML = `
    <span style="display:flex;align-items:center;color:inherit;"><i data-lucide="${iconName}"></i></span>
    <span style="flex:1;">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Currency & Date Formatting Helpers
function formatCurrency(amount, currency = 'INR') {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Modal Controllers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Check route protection on page load
function requireAuth() {
  if (!API.isAuthenticated()) {
    window.location.href = '/login.html';
  }
}

// Setup common shell UI (user header, notifications, mobile nav toggle)
document.addEventListener('DOMContentLoaded', async () => {
  // Mobile drawer toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      if (backdrop) backdrop.classList.toggle('active');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    });
  }

  // Populate user profile info in top bar if present
  const user = API.getUser();
  if (user) {
    const avatarEl = document.querySelector('.user-avatar-circle');
    const nameEl = document.querySelector('.user-name-label');
    const welcomeEl = document.getElementById('welcome-heading');

    if (avatarEl && user.name) {
      avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    if (nameEl && user.name) {
      nameEl.textContent = user.name.split(' ')[0];
    }
    if (welcomeEl && user.name) {
      const hours = new Date().getHours();
      const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
      welcomeEl.textContent = `${greeting}, ${user.name.split(' ')[0]}! Ready to make smart money moves?`;
    }
  }

  // Theme button hookup
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', window.toggleTheme);
  }

  // Notifications trigger
  const notifBtn = document.getElementById('notif-dropdown-btn');
  const notifMenu = document.getElementById('notif-dropdown-menu');
  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('active');
      if (notifMenu.classList.contains('active')) {
        await loadNotifications();
      }
    });

    document.addEventListener('click', () => {
      notifMenu.classList.remove('active');
    });
  }

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

async function loadNotifications() {
  const listEl = document.getElementById('notif-list');
  const badgeEl = document.getElementById('notif-badge');
  if (!listEl) return;

  try {
    const res = await API.get('/notifications');
    if (res.data && res.data.length > 0) {
      listEl.innerHTML = res.data.map(n => `
        <div class="dropdown-item ${n.isRead ? '' : 'unread'}" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
          <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;">
            ${n.title}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">${n.message}</div>
          <div style="font-size:10px;color:var(--text-muted);">${formatDate(n.createdAt)}</div>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;">No new notifications</div>`;
    }

    if (badgeEl) {
      badgeEl.textContent = res.unreadCount || 0;
      badgeEl.style.display = res.unreadCount > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {
    console.error('Failed to load notifications:', e);
  }
}

// Global window assignments
window.API = API;
window.showToast = showToast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.openModal = openModal;
window.closeModal = closeModal;
window.requireAuth = requireAuth;
window.logout = function () {
  API.clearAuth();
  showToast('Logged out securely.', 'info');
  setTimeout(() => window.location.href = '/login.html', 500);
};
