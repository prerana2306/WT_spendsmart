const SavingsGoal = require('../models/SavingsGoal');
const { createInAppNotification } = require('../services/notificationService');

// @desc    Get all savings goals for user
// @route   GET /api/goals
exports.getGoals = async (req, res, next) => {
  try {
    const goals = await SavingsGoal.find({ user: req.user.id }).sort('deadline');
    res.status(200).json({ success: true, count: goals.length, data: goals });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single goal
// @route   GET /api/goals/:id
exports.getGoalById = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Savings goal not found.' });
    }
    res.status(200).json({ success: true, data: goal });
  } catch (error) {
    next(error);
  }
};

// @desc    Create savings goal
// @route   POST /api/goals
exports.createGoal = async (req, res, next) => {
  try {
    const { name, targetAmount, currentAmount, deadline, category, description } = req.body;

    if (!name || !targetAmount || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Goal name, target amount and deadline date are required.',
      });
    }

    const goal = await SavingsGoal.create({
      user: req.user.id,
      name: name.trim(),
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      deadline: new Date(deadline),
      category: category || 'Other',
      description: description ? description.trim() : '',
    });

    await createInAppNotification({
      userId: req.user.id,
      title: 'New Savings Goal Created',
      message: `You started the '${goal.name}' goal for ₹${goal.targetAmount.toLocaleString()}. Let's reach it!`,
      type: 'goal',
      link: '/goals.html',
    });

    res.status(201).json({
      success: true,
      message: 'Savings goal created successfully!',
      data: goal,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update goal
// @route   PUT /api/goals/:id
exports.updateGoal = async (req, res, next) => {
  try {
    let goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const { name, targetAmount, currentAmount, deadline, category, description, isCompleted } = req.body;

    if (name) goal.name = name.trim();
    if (targetAmount !== undefined) goal.targetAmount = parseFloat(targetAmount);
    if (currentAmount !== undefined) goal.currentAmount = parseFloat(currentAmount);
    if (deadline) goal.deadline = new Date(deadline);
    if (category) goal.category = category;
    if (description !== undefined) goal.description = description.trim();
    if (isCompleted !== undefined) goal.isCompleted = isCompleted;

    if (goal.currentAmount >= goal.targetAmount && !goal.isCompleted) {
      goal.isCompleted = true;
      await createInAppNotification({
        userId: req.user.id,
        title: 'Goal Achieved! 🎉',
        message: `Congratulations! You reached your target for '${goal.name}'.`,
        type: 'goal',
        link: '/goals.html',
      });
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: 'Goal updated successfully!',
      data: goal,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete goal
// @route   DELETE /api/goals/:id
exports.deleteGoal = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    res.status(200).json({ success: true, message: 'Savings goal deleted.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add contribution to savings goal
// @route   POST /api/goals/:id/contributions
exports.addContribution = async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    const contributionAmt = parseFloat(amount);

    if (!contributionAmt || contributionAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid contribution amount.' });
    }

    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    goal.currentAmount += contributionAmt;
    goal.contributions.push({
      amount: contributionAmt,
      date: new Date(),
      note: note ? note.trim() : '',
    });

    if (goal.currentAmount >= goal.targetAmount && !goal.isCompleted) {
      goal.isCompleted = true;
      await createInAppNotification({
        userId: req.user.id,
        title: 'Goal Achieved! 🎉',
        message: `Congratulations! You have completed your savings target for '${goal.name}'.`,
        type: 'goal',
        link: '/goals.html',
      });
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: `Added ₹${contributionAmt.toLocaleString()} to ${goal.name}!`,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
};
