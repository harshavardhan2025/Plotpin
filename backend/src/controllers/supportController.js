/**
 * Customer & Legal Support Ticket Controller
 */
const { db } = require('../config/database');

exports.createTicket = async (req, res, next) => {
  try {
    const { category, subject, details, priority, propertyId, propertyTitle, isSoldProperty, isPurchasedProperty } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject is required" });

    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    if (!isAdmin && !propertyId && !propertyTitle) {
      return res.status(400).json({ 
        error: "Support tickets are strictly reserved for verified buyers and sellers. Please select your associated bought or listed property." 
      });
    }

    // Enforce high/urgent priority if related to a sold/purchased property or dispute
    let calculatedPriority = priority || "medium";
    const isDealRelated = Boolean(isSoldProperty || isPurchasedProperty || category === 'title_dispute' || category === 'escrow_clearance' || category === 'possession_delay');
    if (isDealRelated) {
      calculatedPriority = "urgent";
    }

    const newTicket = {
      _id: db.generateId('tkt'),
      userId: req.user._id,
      userName: req.user.name,
      userMobile: req.user.mobile,
      category: category || (isDealRelated ? "title_dispute" : "general_inquiry"),
      subject: subject.trim(),
      message: details || subject,
      propertyId: propertyId || null,
      propertyTitle: propertyTitle || null,
      isSoldProperty: isDealRelated,
      status: "open",
      priority: calculatedPriority,
      assignedStaff: calculatedPriority === "urgent" ? "Senior RERA Legal Registrar (Fast-Track)" : "RERA Legal Desk Duty Officer",
      createdAt: new Date(),
      adminReply: null
    };

    await db.insertSupportTicket(newTicket);

    res.status(201).json({
      success: true,
      message: calculatedPriority === "urgent"
        ? "🚨 URGENT Priority Escalation logged! Post-Purchase & Sold Property cases receive expedited RERA Legal Registrar review within 4 business hours."
        : "Support ticket logged. Priority desk advocate assigned.",
      ticket: newTicket
    });
  } catch (error) {
    next(error);
  }
};

exports.getTickets = (req, res) => {
  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  let tickets;

  if (isAdmin) {
    tickets = (db.supportTickets || []).slice();
  } else {
    tickets = (db.supportTickets || []).filter(t => t.userId === req.user._id);
  }

  // Sort by priority (urgent first) then newest first
  tickets.sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  res.json({
    success: true,
    tickets
  });
};
