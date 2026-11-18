const Transaction = require('../models/Transaction');
const Reminder = require('../models/Reminder');
const SavingsGoal = require('../models/SavingsGoal');

// @desc    Get month calendar events (transactions + reminders)
// @route   GET /api/calendar
exports.getCalendarEvents = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const queryYear = parseInt(year) || now.getFullYear();
    const queryMonth = parseInt(month) || now.getMonth() + 1; // 1-12

    const startOfMonth = new Date(queryYear, queryMonth - 1, 1);
    const endOfMonth = new Date(queryYear, queryMonth, 0, 23, 59, 59);

    // 1. Transactions in this month
    const transactions = await Transaction.find({
      user: req.user.id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort('date');

    // 2. Reminders / Due bills in this month
    const reminders = await Reminder.find({
      user: req.user.id,
      dueDate: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort('dueDate');

    // Group events by day of month (YYYY-MM-DD)
    const dayMap = {};

    transactions.forEach((tx) => {
      const dateKey = new Date(tx.date).toISOString().split('T')[0];
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = { date: dateKey, totalIncome: 0, totalExpenses: 0, transactions: [], reminders: [] };
      }
      if (tx.type === 'income') {
        dayMap[dateKey].totalIncome += tx.amount;
      } else {
        dayMap[dateKey].totalExpenses += tx.amount;
      }
      dayMap[dateKey].transactions.push(tx);
    });

    reminders.forEach((r) => {
      const dateKey = new Date(r.dueDate).toISOString().split('T')[0];
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = { date: dateKey, totalIncome: 0, totalExpenses: 0, transactions: [], reminders: [] };
      }
      dayMap[dateKey].reminders.push(r);
    });

    res.status(200).json({
      success: true,
      data: {
        year: queryYear,
        month: queryMonth,
        dayMap,
        transactions,
        reminders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add reminder / subscription
// @route   POST /api/calendar/reminders
exports.createReminder = async (req, res, next) => {
  try {
    const { title, amount, dueDate, type, category, recurringFrequency, notes } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ success: false, message: 'Title and due date are required.' });
    }

    const reminder = await Reminder.create({
      user: req.user.id,
      title: title.trim(),
      amount: parseFloat(amount) || 0,
      dueDate: new Date(dueDate),
      type: type || 'bill',
      category: category || 'Bills',
      recurringFrequency: recurringFrequency || 'monthly',
      notes: notes ? notes.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: 'Reminder added successfully!',
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update reminder
// @route   PUT /api/calendar/reminders/:id
exports.updateReminder = async (req, res, next) => {
  try {
    let reminder = await Reminder.findOne({ _id: req.params.id, user: req.user.id });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    const { title, amount, dueDate, type, category, recurringFrequency, notes, isPaid } = req.body;

    if (title) reminder.title = title.trim();
    if (amount !== undefined) reminder.amount = parseFloat(amount);
    if (dueDate) reminder.dueDate = new Date(dueDate);
    if (type) reminder.type = type;
    if (category) reminder.category = category;
    if (recurringFrequency) reminder.recurringFrequency = recurringFrequency;
    if (notes !== undefined) reminder.notes = notes.trim();
    if (isPaid !== undefined) {
      reminder.isPaid = isPaid;
      reminder.paidDate = isPaid ? new Date() : null;
    }

    await reminder.save();

    res.status(200).json({
      success: true,
      message: 'Reminder updated successfully!',
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete reminder
// @route   DELETE /api/calendar/reminders/:id
exports.deleteReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    res.status(200).json({ success: true, message: 'Reminder deleted.' });
  } catch (error) {
    next(error);
  }
};
