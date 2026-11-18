const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { createInAppNotification } = require('../services/notificationService');

// @desc    Get all transactions with search and filter
// @route   GET /api/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const {
      search,
      category,
      type,
      paymentMethod,
      classification,
      startDate,
      endDate,
      limit = 100,
      page = 1,
      sort = '-date',
    } = req.query;

    const query = { user: req.user.id };

    if (search && search.trim().length > 0) {
      query.$or = [
        { description: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    if (classification && classification !== 'all') {
      query.classification = classification;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit) || 1,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
exports.createTransaction = async (req, res, next) => {
  try {
    const { type, amount, description, category, date, paymentMethod, notes, classification } = req.body;

    if (!type || !amount || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide type, amount, description and category.',
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number.',
      });
    }

    let receiptUrl = '';
    if (req.file) {
      receiptUrl = `/uploads/${req.file.filename}`;
    }

    const transactionData = {
      user: req.user.id,
      type,
      amount: parsedAmount,
      description: description.trim(),
      category,
      paymentMethod: paymentMethod || 'UPI',
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : '',
      receiptUrl,
    };

    if (classification) {
      transactionData.classification = classification;
    }

    const transaction = await Transaction.create(transactionData);

    // Check budget alert if expense
    if (type === 'expense') {
      const txDate = new Date(transaction.date);
      const monthStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      const budget = await Budget.findOne({ user: req.user.id, month: monthStr });

      if (budget && budget.overallLimit > 0) {
        const startOfMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1);
        const endOfMonth = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 0, 23, 59, 59);

        const monthExpensesAgg = await Transaction.aggregate([
          { $match: { user: req.user._id, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const currentTotal = monthExpensesAgg.length > 0 ? monthExpensesAgg[0].total : 0;
        if (currentTotal > budget.overallLimit) {
          await createInAppNotification({
            userId: req.user.id,
            title: 'Budget Exceeded!',
            message: `Your monthly expenses of ₹${currentTotal.toLocaleString()} have exceeded your budget limit of ₹${budget.overallLimit.toLocaleString()}.`,
            type: 'budget',
            link: '/budgets.html',
          });
        } else if (currentTotal >= budget.overallLimit * 0.9) {
          await createInAppNotification({
            userId: req.user.id,
            title: 'Budget Alert (90%)',
            message: `Warning: You have used 90% of your monthly budget (₹${currentTotal.toLocaleString()} / ₹${budget.overallLimit.toLocaleString()}).`,
            type: 'budget',
            link: '/budgets.html',
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully!',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
exports.updateTransaction = async (req, res, next) => {
  try {
    let transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const { type, amount, description, category, date, paymentMethod, notes, classification } = req.body;

    if (type) transaction.type = type;
    if (amount !== undefined) transaction.amount = parseFloat(amount);
    if (description) transaction.description = description.trim();
    if (category) transaction.category = category;
    if (date) transaction.date = new Date(date);
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (notes !== undefined) transaction.notes = notes.trim();
    if (classification) transaction.classification = classification;

    if (req.file) {
      transaction.receiptUrl = `/uploads/${req.file.filename}`;
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully!',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully!',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export transactions as CSV
// @route   GET /api/transactions/export/csv
exports.exportCSV = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort('-date');

    const headers = 'ID,Date,Type,Amount,Description,Category,Classification,Payment Method,Notes\n';
    const rows = transactions.map((t) => {
      const dateStr = new Date(t.date).toISOString().split('T')[0];
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      const notes = `"${(t.notes || '').replace(/"/g, '""')}"`;
      return `${t._id},${dateStr},${t.type},${t.amount},${desc},${t.category},${t.classification},${t.paymentMethod},${notes}`;
    });

    const csvContent = headers + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=SpendSmart_Transactions.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
