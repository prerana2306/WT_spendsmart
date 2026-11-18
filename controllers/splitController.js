const SplitBillGroup = require('../models/SplitBillGroup');
const SplitBillExpense = require('../models/SplitBillExpense');
const SplitBillSettlement = require('../models/SplitBillSettlement');

// @desc    Get all split groups user belongs to or created
// @route   GET /api/splits/groups
exports.getGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const groups = await SplitBillGroup.find({
      $or: [{ createdBy: userId }, { 'members.user': userId }, { 'members.email': req.user.email }],
    }).sort('-updatedAt');

    res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    next(error);
  }
};

// @desc    Create split group
// @route   POST /api/splits/groups
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, members } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required.' });
    }

    // Include the creator automatically as first member
    const initialMembers = [
      {
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
    ];

    if (Array.isArray(members)) {
      members.forEach((m) => {
        if (m.name && m.name.trim() && m.name.trim() !== req.user.name) {
          initialMembers.push({
            name: m.name.trim(),
            email: m.email ? m.email.trim().toLowerCase() : '',
          });
        }
      });
    }

    const group = await SplitBillGroup.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: req.user._id,
      members: initialMembers,
    });

    res.status(201).json({
      success: true,
      message: 'Split group created successfully!',
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to group
// @route   POST /api/splits/groups/:id/members
exports.addMember = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Member name is required.' });
    }

    const group = await SplitBillGroup.findOne({
      _id: req.params.id,
      $or: [{ createdBy: req.user._id }, { 'members.user': req.user._id }],
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or access denied.' });
    }

    group.members.push({
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : '',
    });

    await group.save();

    res.status(200).json({ success: true, message: 'Member added to group!', data: group });
  } catch (error) {
    next(error);
  }
};

// @desc    Get group details, expenses, balances, and settlements
// @route   GET /api/splits/groups/:id
exports.getGroupDetails = async (req, res, next) => {
  try {
    const group = await SplitBillGroup.findOne({
      _id: req.params.id,
      $or: [{ createdBy: req.user._id }, { 'members.user': req.user._id }, { 'members.email': req.user.email }],
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized.' });
    }

    const expenses = await SplitBillExpense.find({ group: group._id }).sort('-date');
    const settlements = await SplitBillSettlement.find({ group: group._id }).sort('-settledAt');

    // Calculate Net Balances per member
    // Net balance = (Total paid by member) - (Total share owed by member) + (Settlements received) - (Settlements paid)
    const balances = {};
    group.members.forEach((m) => {
      balances[m._id.toString()] = {
        memberId: m._id,
        name: m.name,
        email: m.email,
        totalPaid: 0,
        totalOwed: 0,
        settledOut: 0,
        settledIn: 0,
        netBalance: 0,
      };
    });

    expenses.forEach((exp) => {
      const payerId = exp.paidBy.memberId.toString();
      if (balances[payerId]) {
        balances[payerId].totalPaid += exp.totalAmount;
      }

      exp.splits.forEach((split) => {
        const debtorId = split.memberId.toString();
        if (balances[debtorId]) {
          balances[debtorId].totalOwed += split.share;
        }
      });
    });

    settlements.forEach((st) => {
      const fromId = st.fromMemberId.toString();
      const toId = st.toMemberId.toString();
      if (balances[fromId]) balances[fromId].settledOut += st.amount;
      if (balances[toId]) balances[toId].settledIn += st.amount;
    });

    // Compute net balance: Positive = is owed money, Negative = owes money
    Object.values(balances).forEach((b) => {
      b.netBalance = Math.round((b.totalPaid - b.totalOwed + b.settledOut - b.settledIn) * 100) / 100;
    });

    res.status(200).json({
      success: true,
      data: {
        group,
        expenses,
        settlements,
        balances: Object.values(balances),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add expense to group
// @route   POST /api/splits/groups/:id/expenses
exports.addExpense = async (req, res, next) => {
  try {
    const { title, totalAmount, paidByMemberId, splitType = 'equal', customSplits, notes, date } = req.body;

    const group = await SplitBillGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const amount = parseFloat(totalAmount);
    if (!title || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid expense title and amount.' });
    }

    const payer = group.members.find((m) => m._id.toString() === paidByMemberId);
    if (!payer) {
      return res.status(400).json({ success: false, message: 'Selected payer is not a member of this group.' });
    }

    let splits = [];
    if (splitType === 'equal') {
      const perPersonShare = Math.round((amount / group.members.length) * 100) / 100;
      splits = group.members.map((m) => ({
        memberId: m._id,
        name: m.name,
        userId: m.user,
        share: perPersonShare,
        paid: m._id.toString() === payer._id.toString(),
      }));
    } else {
      // Custom splits validation
      if (!Array.isArray(customSplits) || customSplits.length === 0) {
        return res.status(400).json({ success: false, message: 'Custom splits must be specified for each member.' });
      }
      splits = customSplits.map((cs) => ({
        memberId: cs.memberId,
        name: cs.name,
        share: parseFloat(cs.share) || 0,
        paid: cs.memberId.toString() === payer._id.toString(),
      }));
    }

    const expense = await SplitBillExpense.create({
      group: group._id,
      title: title.trim(),
      totalAmount: amount,
      paidBy: {
        memberId: payer._id,
        userId: payer.user,
        name: payer.name,
      },
      splitType,
      splits,
      notes: notes ? notes.trim() : '',
      date: date ? new Date(date) : new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Expense added to group!',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record settlement between members
// @route   POST /api/splits/settlements
exports.recordSettlement = async (req, res, next) => {
  try {
    const { groupId, fromMemberId, toMemberId, amount, notes } = req.body;

    const group = await SplitBillGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const fromMember = group.members.find((m) => m._id.toString() === fromMemberId);
    const toMember = group.members.find((m) => m._id.toString() === toMemberId);

    if (!fromMember || !toMember) {
      return res.status(400).json({ success: false, message: 'Both settlement members must be in the group.' });
    }

    const settleAmount = parseFloat(amount);
    if (!settleAmount || settleAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid settlement amount.' });
    }

    const settlement = await SplitBillSettlement.create({
      group: group._id,
      fromMemberId: fromMember._id,
      fromName: fromMember.name,
      toMemberId: toMember._id,
      toName: toMember.name,
      amount: settleAmount,
      notes: notes ? notes.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: `Settlement of ₹${settleAmount.toLocaleString()} from ${fromMember.name} to ${toMember.name} recorded!`,
      data: settlement,
    });
  } catch (error) {
    next(error);
  }
};
