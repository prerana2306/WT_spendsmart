const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Reminder = require('../models/Reminder');
const ChallengeProgress = require('../models/ChallengeProgress');
const Badge = require('../models/Badge');
const SplitBillGroup = require('../models/SplitBillGroup');
const SplitBillExpense = require('../models/SplitBillExpense');
const SplitBillSettlement = require('../models/SplitBillSettlement');
const Notification = require('../models/Notification');
const { sendEmail, createInAppNotification } = require('../services/notificationService');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'spendsmart_student_fintech_super_secret_jwt_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register new student
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, college, termsAccepted } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Generate 6-digit OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      college: college || '',
      verificationOTP: otp,
      otpExpires,
      isVerified: false,
    });

    // Send email with OTP (or log for local testing)
    await sendEmail({
      to: user.email,
      subject: 'SpendSmart — Verify Your Student Email',
      text: `Welcome to SpendSmart, ${user.name}! Your 6-digit verification code is: ${otp}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #E8E8DE; border-radius: 12px;">
          <h2 style="color: #294C3A;">Welcome to SpendSmart</h2>
          <p>Hi ${user.name}, your account has been created. Use the verification code below to confirm your student email:</p>
          <div style="background: #F7F4EA; padding: 15px; border-radius: 8px; font-size: 26px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #294C3A; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #758077; font-size: 13px;">This code will expire in 15 minutes. If you did not register for SpendSmart, please ignore this email.</p>
        </div>
      `,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created! Please verify your email with the 6-digit OTP.',
      token,
      // We also include devOtp in development so testers never get blocked if SMTP is not configured
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and 6-digit OTP code.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+verificationOTP +otpExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified.',
      });
    }

    if (user.verificationOTP !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    user.isVerified = true;
    user.verificationOTP = undefined;
    user.otpExpires = undefined;
    await user.save();

    await createInAppNotification({
      userId: user._id,
      title: 'Email Verified',
      message: 'Your student account is now verified! Welcome to SpendSmart.',
      type: 'system',
    });

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: true,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login student
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        isVerified: user.isVerified,
        onboardingCompleted: user.onboardingCompleted,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide your email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't disclose account existence for security, return generic success
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, reset instructions have been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 mins
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'SpendSmart — Password Reset Request',
      text: `You requested a password reset. Your reset token is: ${resetToken}`,
      html: `<p>Use this reset token to change your password: <b>${resetToken}</b>. Valid for 30 minutes.</p>`,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset instructions have been sent.',
      devResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password with token
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, password } = req.body;

    if (!resetToken || !password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current Logged-in Profile
// @route   GET /api/auth/profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Profile & Preferences
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, college, preferences } = req.body;
    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (college !== undefined) user.college = college;
    if (preferences) {
      user.preferences = {
        ...user.preferences.toObject(),
        ...preferences,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete Onboarding
// @route   POST /api/auth/onboarding
exports.completeOnboarding = async (req, res, next) => {
  try {
    const { incomeSource, monthlyIncome, monthlyBudget, savingsGoal } = req.body;
    const user = await User.findById(req.user.id);

    user.onboardingCompleted = true;
    if (incomeSource) user.preferences.incomeSource = incomeSource;
    if (monthlyIncome !== undefined) user.preferences.monthlyIncome = parseFloat(monthlyIncome) || 0;
    if (monthlyBudget !== undefined) user.preferences.monthlyBudget = parseFloat(monthlyBudget) || 0;

    await user.save();

    // If student entered initial monthly budget, create Budget record for current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyBudget && parseFloat(monthlyBudget) > 0) {
      await Budget.findOneAndUpdate(
        { user: user._id, month: currentMonthStr },
        {
          user: user._id,
          month: currentMonthStr,
          overallLimit: parseFloat(monthlyBudget),
        },
        { upsert: true, new: true }
      );
    }

    // If student provided initial savings goal, create it
    if (savingsGoal && savingsGoal.name && savingsGoal.targetAmount) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 3);

      await SavingsGoal.create({
        user: user._id,
        name: savingsGoal.name,
        targetAmount: parseFloat(savingsGoal.targetAmount),
        currentAmount: parseFloat(savingsGoal.currentAmount || 0),
        category: savingsGoal.category || 'Emergency Fund',
        deadline: targetDate,
        description: 'Created during onboarding',
      });
    }

    await createInAppNotification({
      userId: user._id,
      title: 'Welcome to SpendSmart!',
      message: 'Onboarding completed. Your smart financial journey starts now!',
      type: 'system',
    });

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully!',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export All Personal Data (JSON)
// @route   GET /api/auth/export-data
exports.exportPersonalData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const transactions = await Transaction.find({ user: userId });
    const budgets = await Budget.find({ user: userId });
    const goals = await SavingsGoal.find({ user: userId });
    const reminders = await Reminder.find({ user: userId });
    const badges = await Badge.find({ user: userId });

    const exportBundle = {
      exportDate: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
        college: user.college,
        preferences: user.preferences,
      },
      transactions,
      budgets,
      savingsGoals: goals,
      reminders,
      badges,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=SpendSmart_Export_${user.name.replace(/\s+/g, '_')}.json`);
    res.status(200).send(JSON.stringify(exportBundle, null, 2));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Account & All Associated Records
// @route   DELETE /api/auth/delete-account
exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Transaction.deleteMany({ user: userId });
    await Budget.deleteMany({ user: userId });
    await SavingsGoal.deleteMany({ user: userId });
    await Reminder.deleteMany({ user: userId });
    await ChallengeProgress.deleteMany({ user: userId });
    await Badge.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Your account and all associated financial records have been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};
