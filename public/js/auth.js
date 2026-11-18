/**
 * SpendSmart Authentication & Onboarding Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Password Visibility Toggle
  const toggleButtons = document.querySelectorAll('.toggle-password-btn');
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        const icon = btn.querySelector('i, svg');
        if (icon) {
          icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  });

  // 2. Password Strength Indicator
  const passwordInput = document.getElementById('register-password');
  const strengthFill = document.getElementById('strength-fill');
  const strengthLabel = document.getElementById('strength-label');

  if (passwordInput && strengthFill && strengthLabel) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      if (val.length >= 6) score += 1;
      if (val.match(/[A-Z]/) && val.match(/[0-9]/)) score += 1;
      if (val.match(/[^A-Za-z0-9]/) && val.length >= 8) score += 1;

      strengthFill.className = 'strength-meter-fill';
      if (val.length === 0) {
        strengthFill.style.width = '0%';
        strengthLabel.textContent = '';
      } else if (score <= 1) {
        strengthFill.classList.add('weak');
        strengthLabel.textContent = 'Weak (add numbers & symbols)';
        strengthLabel.style.color = 'var(--muted-coral)';
      } else if (score === 2) {
        strengthFill.classList.add('medium');
        strengthLabel.textContent = 'Good (mix uppercase & symbols)';
        strengthLabel.style.color = 'var(--butter-yellow)';
      } else {
        strengthFill.classList.add('strong');
        strengthLabel.textContent = 'Strong student password!';
        strengthLabel.style.color = 'var(--sage-green)';
      }
    });
  }

  // 3. Login Form Submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        const res = await API.post('/auth/login', { email, password });
        API.setToken(res.token);
        API.setUser(res.user);

        showToast('Login successful! Welcome back.', 'success');
        setTimeout(() => {
          if (!res.user.onboardingCompleted) {
            window.location.href = '/onboarding.html';
          } else {
            window.location.href = '/dashboard.html';
          }
        }, 600);
      } catch (err) {
        showToast(err.message, 'danger');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // 4. Quick Demo Student Login Button
  const demoLoginBtn = document.getElementById('demo-login-btn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', async () => {
      try {
        demoLoginBtn.disabled = true;
        demoLoginBtn.textContent = 'Loading Demo Account...';

        const res = await API.post('/auth/login', {
          email: 'demo@spendsmart.com',
          password: 'password123',
        });

        API.setToken(res.token);
        API.setUser(res.user);

        showToast('Connected to Aarav Sharma (Demo Account)!', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 500);
      } catch (err) {
        showToast('Demo account not seeded yet. Please seed or register a new account.', 'warning');
        demoLoginBtn.disabled = false;
        demoLoginBtn.textContent = 'Try Demo Student';
      }
    });
  }

  // 5. Register Form Submit
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;
      const college = document.getElementById('reg-college').value.trim();
      const termsAccepted = document.getElementById('reg-terms').checked;
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      if (!termsAccepted) {
        return showToast('Please accept the terms and student privacy policy.', 'warning');
      }

      if (password !== confirmPassword) {
        return showToast('Passwords do not match.', 'danger');
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const res = await API.post('/auth/register', {
          name,
          email,
          password,
          college,
          termsAccepted,
        });

        API.setToken(res.token);
        API.setUser(res.user);

        // Open OTP Verification Modal
        const otpModal = document.getElementById('otp-modal');
        const otpEmailSpan = document.getElementById('otp-email-display');
        const otpInput = document.getElementById('otp-code-input');

        if (otpEmailSpan) otpEmailSpan.textContent = email;
        if (res.devOtp && otpInput) {
          otpInput.value = res.devOtp; // Helpful auto-fill in local dev environment
          showToast(`Verification code generated: ${res.devOtp}`, 'info');
        }

        if (otpModal) {
          openModal('otp-modal');
        } else {
          showToast('Account registered! Proceeding to onboarding...', 'success');
          setTimeout(() => (window.location.href = '/onboarding.html'), 1000);
        }
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Student Account';
      }
    });
  }

  // 6. OTP Verification Form Submit
  const otpForm = document.getElementById('otp-form');
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = API.getUser();
      const email = user ? user.email : document.getElementById('reg-email').value.trim();
      const otp = document.getElementById('otp-code-input').value.trim();
      const verifyBtn = otpForm.querySelector('button[type="submit"]');

      try {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        const res = await API.post('/auth/verify-email', { email, otp });
        API.setToken(res.token);
        API.setUser(res.user);

        showToast('Email verified successfully! Welcome!', 'success');
        setTimeout(() => {
          window.location.href = '/onboarding.html';
        }, 700);
      } catch (err) {
        showToast(err.message, 'danger');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Email';
      }
    });
  }

  // 7. Forgot Password Trigger
  const forgotBtn = document.getElementById('forgot-password-link');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('forgot-password-modal');
    });
  }

  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email-input').value.trim();
      try {
        const res = await API.post('/auth/forgot-password', { email });
        showToast(res.message, 'info');
        closeModal('forgot-password-modal');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }
});
