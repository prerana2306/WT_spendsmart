require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Budget = require('./models/Budget');
const SavingsGoal = require('./models/SavingsGoal');
const Reminder = require('./models/Reminder');
const Challenge = require('./models/Challenge');
const ChallengeProgress = require('./models/ChallengeProgress');
const Badge = require('./models/Badge');
const SplitBillGroup = require('./models/SplitBillGroup');
const SplitBillExpense = require('./models/SplitBillExpense');
const SplitBillSettlement = require('./models/SplitBillSettlement');
const Notification = require('./models/Notification');

async function seedData() {
  try {
    await connectDB();
    console.log('[SpendSmart Seeder] Connected to MongoDB. Seeding realistic student records...');

    // Remove existing demo student if exists
    const demoEmail = 'demo@spendsmart.com';
    const existingDemo = await User.findOne({ email: demoEmail });
    if (existingDemo) {
      await Transaction.deleteMany({ user: existingDemo._id });
      await Budget.deleteMany({ user: existingDemo._id });
      await SavingsGoal.deleteMany({ user: existingDemo._id });
      await Reminder.deleteMany({ user: existingDemo._id });
      await ChallengeProgress.deleteMany({ user: existingDemo._id });
      await Badge.deleteMany({ user: existingDemo._id });
      await SplitBillGroup.deleteMany({ createdBy: existingDemo._id });
      await Notification.deleteMany({ user: existingDemo._id });
      await User.findByIdAndDelete(existingDemo._id);
    }

    // 1. Create Demo Student User
    const demoUser = await User.create({
      name: 'Aarav Sharma',
      email: demoEmail,
      password: 'password123',
      college: 'Delhi University / IIT Delhi',
      isVerified: true,
      onboardingCompleted: true,
      preferences: {
        incomeSource: 'Monthly allowance',
        monthlyIncome: 18000,
        monthlyBudget: 14000,
        currency: 'INR',
        theme: 'system',
        notifications: {
          emailAlerts: true,
          budgetAlerts: true,
          anomalyAlerts: true,
          challengeReminders: true,
        },
      },
    });

    console.log(`[SpendSmart Seeder] Demo User Created: ${demoUser.email} / password123`);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed
    const curMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    // 2. Seed Realistic Transactions
    const transactions = [
      // Current Month Income
      {
        user: demoUser._id,
        type: 'income',
        amount: 14000,
        description: 'Monthly Allowance from Parents',
        category: 'Allowance',
        classification: 'need',
        paymentMethod: 'Net Banking',
        date: new Date(curYear, curMonth, 1),
        notes: 'Monthly pocket allowance for hostel & mess',
      },
      {
        user: demoUser._id,
        type: 'income',
        amount: 4000,
        description: 'Web Design Freelance Gig',
        category: 'Freelance',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 5),
        notes: 'Logo and landing page design for student club',
      },

      // Current Month Needs Expenses
      {
        user: demoUser._id,
        type: 'expense',
        amount: 4500,
        description: 'Hostel Accommodation & Utility Share',
        category: 'Hostel',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 2),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 1450,
        description: 'Engineering Textbooks & Class Notes',
        category: 'Education',
        classification: 'need',
        paymentMethod: 'Debit Card',
        date: new Date(curYear, curMonth, 4),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 850,
        description: 'Monthly Metro SmartCard Recharge',
        category: 'Transport',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 6),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 1850,
        description: 'Campus Cafeteria & Meals',
        category: 'Food',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 8),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 320,
        description: 'Pharmacy Cold Medicine & Vitamins',
        category: 'Healthcare',
        classification: 'need',
        paymentMethod: 'Cash',
        date: new Date(curYear, curMonth, 10),
      },

      // Current Month Wants Expenses
      {
        user: demoUser._id,
        type: 'expense',
        amount: 699,
        description: 'Weekend Pizza Night with Roommates',
        category: 'Food',
        classification: 'want',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 9),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 1200,
        description: 'Graphic T-Shirt & Sneaker cleaner',
        category: 'Shopping',
        classification: 'want',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 12),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 499,
        description: 'Movie Ticket & Popcorn (Inox)',
        category: 'Entertainment',
        classification: 'want',
        paymentMethod: 'Debit Card',
        date: new Date(curYear, curMonth, 14),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 350,
        description: 'Uber Ride back from Campus Hackathon',
        category: 'Transport',
        classification: 'want',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth, 15),
      },

      // Prior Month Transactions (to establish historical baseline for Anomaly Detection!)
      {
        user: demoUser._id,
        type: 'income',
        amount: 15000,
        description: 'Allowance (Prior Month)',
        category: 'Allowance',
        classification: 'need',
        paymentMethod: 'Net Banking',
        date: new Date(curYear, curMonth - 1, 1),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 4500,
        description: 'Hostel Fee (Prior Month)',
        category: 'Hostel',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth - 1, 2),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 1200,
        description: 'Food & Meals (Prior Month)',
        category: 'Food',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth - 1, 8),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 600,
        description: 'Metro Travel (Prior Month)',
        category: 'Transport',
        classification: 'need',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth - 1, 10),
      },
      {
        user: demoUser._id,
        type: 'expense',
        amount: 800,
        description: 'Shopping (Prior Month)',
        category: 'Shopping',
        classification: 'want',
        paymentMethod: 'UPI',
        date: new Date(curYear, curMonth - 1, 15),
      },
    ];

    await Transaction.insertMany(transactions);
    console.log(`[SpendSmart Seeder] ${transactions.length} Transactions seeded.`);

    // 3. Seed Monthly Budget
    await Budget.create({
      user: demoUser._id,
      month: curMonthStr,
      overallLimit: 14000,
      categoryBudgets: [
        { category: 'Hostel', limit: 5000 },
        { category: 'Food', limit: 3500 },
        { category: 'Education', limit: 2000 },
        { category: 'Transport', limit: 1500 },
        { category: 'Shopping', limit: 1000 },
        { category: 'Entertainment', limit: 1000 },
      ],
    });

    // 4. Seed Savings Goals
    const goalDeadline1 = new Date();
    goalDeadline1.setMonth(goalDeadline1.getMonth() + 4);

    const goalDeadline2 = new Date();
    goalDeadline2.setMonth(goalDeadline2.getMonth() + 2);

    const goalDeadline3 = new Date();
    goalDeadline3.setMonth(goalDeadline3.getMonth() + 6);

    await SavingsGoal.create([
      {
        user: demoUser._id,
        name: 'MacBook Air M3 Upgrade',
        targetAmount: 75000,
        currentAmount: 32000,
        category: 'Tech & Gadgets',
        deadline: goalDeadline1,
        description: 'For coding, Flutter development and final year project',
        contributions: [
          { amount: 15000, date: new Date(curYear, curMonth - 1, 5), note: 'Birthday savings gift' },
          { amount: 17000, date: new Date(curYear, curMonth, 3), note: 'Freelance savings allocation' },
        ],
      },
      {
        user: demoUser._id,
        name: 'Semester Break Goa Trip',
        targetAmount: 12000,
        currentAmount: 7500,
        category: 'Travel & Trips',
        deadline: goalDeadline2,
        description: '4-day trip with hostel mates after semester exams',
        contributions: [
          { amount: 5000, date: new Date(curYear, curMonth - 1, 10), note: 'Initial deposit' },
          { amount: 2500, date: new Date(curYear, curMonth, 7), note: 'Weekend savings contribution' },
        ],
      },
      {
        user: demoUser._id,
        name: 'Student Emergency Cushion',
        targetAmount: 10000,
        currentAmount: 6500,
        category: 'Emergency Fund',
        deadline: goalDeadline3,
        description: '3 months of emergency expenses for health or unexpected costs',
        contributions: [
          { amount: 6500, date: new Date(curYear, curMonth, 1), note: 'Monthly safety deposit' },
        ],
      },
    ]);

    // 5. Seed Calendar Reminders
    const due1 = new Date(curYear, curMonth, 22);
    const due2 = new Date(curYear, curMonth, 26);
    const due3 = new Date(curYear, curMonth + 1, 1);

    await Reminder.create([
      {
        user: demoUser._id,
        title: 'Spotify Student Premium Renewal',
        amount: 59,
        dueDate: due1,
        type: 'subscription',
        category: 'Entertainment',
        recurringFrequency: 'monthly',
        notes: 'Auto-debit from student bank account',
      },
      {
        user: demoUser._id,
        title: 'Mobile 5G Data Pack (Airtel)',
        amount: 299,
        dueDate: due2,
        type: 'bill',
        category: 'Bills',
        recurringFrequency: 'monthly',
        notes: '28-day 2GB/day recharge',
      },
      {
        user: demoUser._id,
        title: 'Next Month Hostel Mess Advance',
        amount: 3500,
        dueDate: due3,
        type: 'bill',
        category: 'Hostel',
        recurringFrequency: 'monthly',
        notes: 'Hostel warden office deposit',
      },
    ]);

    // 6. Seed Challenges & Progress
    const CHALLENGE_SEEDS = [
      {
        code: 'no-spend-weekend',
        title: 'No-Spend Weekend',
        description: 'Keep your weekend spending at exactly ₹0 on all non-essential items.',
        category: 'No-Spend',
        durationDays: 2,
        badgeTier: 'Bronze Saver',
        icon: 'coffee',
      },
      {
        code: 'save-500-week',
        title: 'Save ₹500 This Week',
        description: 'Deposit or retain ₹500 in savings across the next 7 days.',
        category: 'Saving Amount',
        durationDays: 7,
        targetAmount: 500,
        badgeTier: 'Bronze Saver',
        icon: 'piggy-bank',
      },
      {
        code: 'saving-streak-7',
        title: '7-Day Saving Streak',
        description: 'Log in and stay within your daily spending limit for 7 consecutive days.',
        category: 'Streak',
        durationDays: 7,
        badgeTier: 'Silver Saver',
        icon: 'flame',
      },
      {
        code: 'avoid-food-delivery',
        title: 'Avoid Food Delivery for 5 Days',
        description: 'No Zomato or Swiggy for 5 weekdays! Eat at the campus mess or cook with roommates.',
        category: 'Category Restriction',
        durationDays: 5,
        targetCategory: 'Food',
        badgeTier: 'Silver Saver',
        icon: 'utensils',
      },
      {
        code: 'save-100-daily',
        title: 'Save ₹100 Every Day',
        description: 'Transfer or set aside ₹100 daily for 10 days to build the daily savings habit.',
        category: 'Saving Amount',
        durationDays: 10,
        targetAmount: 1000,
        badgeTier: 'Gold Saver',
        icon: 'coins',
      },
      {
        code: 'money-master-30',
        title: '30-Day Money Master',
        description: 'Stay within your monthly budget and log all transactions consistently for a full month.',
        category: 'Milestone',
        durationDays: 30,
        badgeTier: 'Money Master',
        icon: 'crown',
      },
    ];

    for (const c of CHALLENGE_SEEDS) {
      await Challenge.findOneAndUpdate({ code: c.code }, c, { upsert: true });
    }

    const defaultChallenges = await Challenge.find();
    if (defaultChallenges.length > 0) {
      // Completed No-Spend Weekend
      const weekendChallenge = defaultChallenges.find((c) => c.code === 'no-spend-weekend') || defaultChallenges[0];
      await ChallengeProgress.create({
        user: demoUser._id,
        challenge: weekendChallenge._id,
        startDate: new Date(curYear, curMonth, 5),
        endDate: new Date(curYear, curMonth, 7),
        status: 'completed',
        currentStreak: 2,
        isBadgeAwarded: true,
        checkIns: [
          { date: '2026-11-05', completed: true, savedAmount: 400, note: 'Stayed in hostel, cooked maggi' },
          { date: '2026-11-06', completed: true, savedAmount: 600, note: 'Read books at library, zero expense' },
        ],
      });

      // Active 7-Day Saving Streak
      const streakChallenge = defaultChallenges.find((c) => c.code === 'saving-streak-7') || defaultChallenges[1];
      await ChallengeProgress.create({
        user: demoUser._id,
        challenge: streakChallenge._id,
        startDate: new Date(curYear, curMonth, 12),
        endDate: new Date(curYear, curMonth, 19),
        status: 'active',
        currentStreak: 4,
        checkIns: [
          { date: '2026-11-12', completed: true, savedAmount: 150 },
          { date: '2026-11-13', completed: true, savedAmount: 200 },
          { date: '2026-11-14', completed: true, savedAmount: 100 },
          { date: '2026-11-15', completed: true, savedAmount: 250 },
        ],
      });

      // Award Badge
      await Badge.create({
        user: demoUser._id,
        code: 'no-spend-weekend',
        title: 'No-Spend Weekend Champion',
        description: 'Successfully completed 48 hours of zero non-essential spending!',
        tier: 'Bronze Saver',
        icon: 'coffee',
      });
    }

    // 7. Seed Split Bill Group & Expenses
    const splitGroup = await SplitBillGroup.create({
      name: 'Flat 402 Roommates',
      description: 'Hostel apartment bills, Wi-Fi, and shared groceries',
      createdBy: demoUser._id,
      members: [
        { user: demoUser._id, name: 'Aarav Sharma', email: demoEmail },
        { name: 'Rohan Gupta', email: 'rohan.gupta@student.ac.in' },
        { name: 'Kabir Verma', email: 'kabir.verma@student.ac.in' },
        { name: 'Sneha Patel', email: 'sneha.patel@student.ac.in' },
      ],
    });

    const m0 = splitGroup.members[0]; // Aarav
    const m1 = splitGroup.members[1]; // Rohan
    const m2 = splitGroup.members[2]; // Kabir
    const m3 = splitGroup.members[3]; // Sneha

    // Shared Dinner expense paid by Aarav
    await SplitBillExpense.create({
      group: splitGroup._id,
      title: 'Hostel Welcome Dinner (Punjabi Rasoi)',
      totalAmount: 1200,
      paidBy: { memberId: m0._id, userId: m0.user, name: m0.name },
      splitType: 'equal',
      splits: [
        { memberId: m0._id, name: m0.name, share: 300, paid: true },
        { memberId: m1._id, name: m1.name, share: 300, paid: false },
        { memberId: m2._id, name: m2.name, share: 300, paid: false },
        { memberId: m3._id, name: m3.name, share: 300, paid: false },
      ],
      date: new Date(curYear, curMonth, 7),
    });

    // Fiber Wi-Fi Bill paid by Rohan
    await SplitBillExpense.create({
      group: splitGroup._id,
      title: 'ACT High-Speed Fiber Internet Bill',
      totalAmount: 999,
      paidBy: { memberId: m1._id, name: m1.name },
      splitType: 'equal',
      splits: [
        { memberId: m0._id, name: m0.name, share: 249.75, paid: true },
        { memberId: m1._id, name: m1.name, share: 249.75, paid: true },
        { memberId: m2._id, name: m2.name, share: 249.75, paid: false },
        { memberId: m3._id, name: m3.name, share: 249.75, paid: false },
      ],
      date: new Date(curYear, curMonth, 10),
    });

    // Partial settlement: Aarav settled his share of Wi-Fi with Rohan
    await SplitBillSettlement.create({
      group: splitGroup._id,
      fromMemberId: m0._id,
      fromName: m0.name,
      toMemberId: m1._id,
      toName: m1.name,
      amount: 250,
      notes: 'Paid via Google Pay UPI',
    });

    // 8. Notifications
    await Notification.create([
      {
        user: demoUser._id,
        title: 'Welcome to SpendSmart!',
        message: 'Your account is ready with realistic student sample data.',
        type: 'system',
      },
      {
        user: demoUser._id,
        title: 'Upcoming Bill Alert',
        message: 'Airtel 5G plan renewal of ₹299 is due in 8 days.',
        type: 'reminder',
        link: '/calendar.html',
      },
      {
        user: demoUser._id,
        title: 'Badge Unlocked 🏆',
        message: 'You earned the Bronze Saver badge for your No-Spend Weekend.',
        type: 'challenge',
        link: '/challenges.html',
      },
    ]);

    console.log('[SpendSmart Seeder] Successfully seeded all realistic student records!');
    console.log('You can now log in using demo credentials:');
    console.log(`Email:    ${demoEmail}`);
    console.log(`Password: password123`);
    process.exit(0);
  } catch (error) {
    console.error('[SpendSmart Seeder Error]:', error);
    process.exit(1);
  }
}

seedData();
