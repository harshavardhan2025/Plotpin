/**
 * Appointments & Inquiries Controller
 */
const { db } = require('../config/database');
const { findPropertyById } = require('./propertyController');
const { isPropertyActionEligible } = require('../utils/propertyEligibility');

exports.createAppointment = async (req, res, next) => {
  try {
    const { propertyId, startAt, endAt, notes } = req.body;

    if (!propertyId || !startAt || !endAt) {
      return res.status(400).json({ error: "Property ID, start time, and end time are required" });
    }

    const prop = findPropertyById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Enforce central action eligibility (removed, pending revision, unapproved, inactive, or owner check)
    const eligibility = isPropertyActionEligible(prop, req.user._id);
    if (!eligibility.eligible) {
      if (eligibility.code === 'OWNER_SELF_ACTION') {
        return res.status(400).json({ 
          error: "Property owners cannot book viewing appointments on their own listings", 
          code: "OWNER_SELF_BOOKING" 
        });
      }
      return res.status(400).json({ error: eligibility.reason, code: eligibility.code });
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid startAt or endAt timestamp format", code: "INVALID_TIMESTAMPS" });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ error: "Appointment start time must be before end time", code: "INVALID_TIME_RANGE" });
    }
    if (startDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: "Appointments cannot be scheduled in the past or immediately. Please select an upcoming slot.", code: "PAST_APPOINTMENT" });
    }

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (60 * 1000);
    if (durationMinutes < 15 || durationMinutes > 180) {
      return res.status(400).json({ 
        error: "Appointment duration must be between 15 minutes and 3 hours.", 
        code: "INVALID_DURATION" 
      });
    }

    const maxAdvanceMs = 180 * 24 * 60 * 60 * 1000; // 180 days
    if (startDate.getTime() > Date.now() + maxAdvanceMs) {
      return res.status(400).json({ 
        error: "Appointments cannot be scheduled more than 180 days in advance.", 
        code: "EXCESSIVE_ADVANCE_BOOKING" 
      });
    }

    const newStart = startDate.getTime();
    const newEnd = endDate.getTime();

    // 1. Property Site Conflict: Two parties cannot visit the same physical property simultaneously
    const propertyConflict = db.appointments.find(a => 
      (a.propertyId === propertyId || a.property_id === propertyId) &&
      a.status === 'confirmed' &&
      newStart < new Date(a.endAt || a.end_at).getTime() && 
      new Date(a.startAt || a.start_at).getTime() < newEnd
    );

    if (propertyConflict) {
      return res.status(409).json({
        error: "This time slot conflicts with an existing confirmed appointment on this property. Please select another time.",
        conflictStart: new Date(propertyConflict.startAt || propertyConflict.start_at).toISOString(),
        conflictEnd: new Date(propertyConflict.endAt || propertyConflict.end_at).toISOString(),
        code: "APPOINTMENT_CONFLICT"
      });
    }

    // 2. User Schedule Conflict: The SAME user cannot book overlapping visit appointments across any property
    const userConflict = db.appointments.find(a => 
      (a.buyerId === req.user._id || a.buyer_id === req.user._id) &&
      a.status === 'confirmed' &&
      newStart < new Date(a.endAt || a.end_at).getTime() && 
      new Date(a.startAt || a.start_at).getTime() < newEnd
    );

    if (userConflict) {
      return res.status(409).json({
        error: `You already have a confirmed site visit scheduled during this time window (${userConflict.propertyTitle || 'another property'}). A single user cannot attend overlapping bookings.`,
        conflictStart: new Date(userConflict.startAt || userConflict.start_at).toISOString(),
        conflictEnd: new Date(userConflict.endAt || userConflict.end_at).toISOString(),
        code: "USER_OVERLAPPING_BOOKING"
      });
    }

    const newAppointment = {
      _id: db.generateId('apt'),
      propertyId: prop._id,
      buyerId: req.user._id,
      ownerId: prop.ownerId,
      propertyTitle: prop.title,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      status: "confirmed",
      notes: notes || "Direct owner visit scheduled through PlotPin",
      createdAt: new Date().toISOString()
    };

    await db.insertAppointment(newAppointment);

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "APPOINTMENT_SCHEDULED",
      entity: "Appointment",
      entityId: newAppointment._id,
      details: `Site visit scheduled for ${prop.title} on ${startDate.toLocaleDateString('en-IN')}`,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: "Viewing appointment confirmed and stored in Supabase!",
      appointment: newAppointment
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointments = (req, res) => {
  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  let appointments;

  if (isAdmin) {
    appointments = db.appointments;
  } else {
    // Both appointments where user is buyer, owner, or matched by email / phone
    appointments = db.appointments.filter(a => 
      a.buyerId === req.user._id || a.ownerId === req.user._id ||
      (req.user.email && (a.customerEmail === req.user.email || a.email === req.user.email)) ||
      (req.user.mobile && (a.customerPhone === req.user.mobile || a.phone === req.user.mobile))
    );
  }

    const now = Date.now();
    const processedAppointments = appointments.map(a => {
      let updated = { ...a };
      if (a.status === 'confirmed' && new Date(a.endAt || a.startAt).getTime() < now) {
        updated.status = 'completed';
      }
      if (!updated.customerName || !updated.customerPhone) {
        const buyer = (db.users || []).find(u => u._id === (a.buyerId || a.buyer_id));
        if (buyer) {
          if (!updated.customerName) updated.customerName = buyer.name;
          if (!updated.customerPhone) updated.customerPhone = buyer.mobile;
          if (!updated.customerEmail) updated.customerEmail = buyer.email;
        }
      }
      if (!updated.propertyTitle) {
        const prop = (db.properties || []).find(p => p._id === (a.propertyId || a.property_id));
        if (prop) {
          updated.propertyTitle = prop.title;
        }
      }
      return updated;
    });

    res.json({
      success: true,
      appointments: processedAppointments
    });
  };

exports.cancelAppointment = async (req, res, next) => {
  try {
    const apt = db.appointments.find(a => a._id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Appointment not found" });

    const isParticipant = apt.buyerId === req.user._id || apt.ownerId === req.user._id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to cancel this appointment" });
    }

    // 20-minute cancellation rule: regular users cannot cancel within 20 minutes of start time or after completion
    if (!isAdmin) {
      const startTimeMs = new Date(apt.startAt).getTime();
      const minutesToStart = (startTimeMs - Date.now()) / (60 * 1000);
      if (minutesToStart < 20) {
        return res.status(400).json({
          error: "Cancellation locked: Site visits cannot be cancelled within 20 minutes of start time or after completion. Please contact Admin Mediator.",
          code: "CANCELLATION_LOCKED_20MIN"
        });
      }
    }

    const cancellationReason = req.body.reason || req.body.cancellationReason || `Cancelled by ${req.user.name}`;
    const updated = await db.updateAppointment(apt._id, { 
      status: "cancelled",
      cancellationReason,
      notes: (apt.notes ? apt.notes + ' | ' : '') + `Cancellation Reason: ${cancellationReason}`,
      updatedAt: new Date().toISOString()
    });

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "APPOINTMENT_CANCELLED",
      entity: "Appointment",
      entityId: apt._id,
      details: `Site visit cancelled by ${req.user.name}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment: updated || apt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reschedule an existing appointment safely:
 * - Validates requester authorization (buyer, owner, admin)
 * - Releases old time slot immediately
 * - Validates new timestamps (non-past, 15-180m duration, <= 180d advance)
 * - Detects concurrent conflicts with other confirmed bookings on the same property
 * - Atomically updates appointment and records audit log
 */
exports.rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newStartAt, newEndAt, notes } = req.body;

    if (!newStartAt || !newEndAt) {
      return res.status(400).json({ 
        error: "newStartAt and newEndAt timestamps are required to reschedule", 
        code: "MISSING_TIMESTAMPS" 
      });
    }

    const apt = db.appointments.find(a => a._id === id);
    if (!apt) {
      return res.status(404).json({ error: "Appointment not found", code: "NOT_FOUND" });
    }

    const isParticipant = apt.buyerId === req.user._id || apt.ownerId === req.user._id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ 
        error: "Forbidden: You are not authorized to reschedule this appointment", 
        code: "FORBIDDEN" 
      });
    }

    if (apt.status === 'cancelled') {
      return res.status(400).json({ 
        error: "Cannot reschedule a cancelled appointment. Please schedule a new visit instead.", 
        code: "APPOINTMENT_ALREADY_CANCELLED" 
      });
    }

    const now = Date.now();
    const currentEndTime = new Date(apt.endAt || apt.startAt).getTime();
    if (apt.status === 'completed' || currentEndTime < now) {
      return res.status(400).json({ 
        error: "Cannot reschedule a past or completed appointment. Please book a fresh visit.", 
        code: "APPOINTMENT_ALREADY_COMPLETED" 
      });
    }

    const startDate = new Date(newStartAt);
    const endDate = new Date(newEndAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        error: "Invalid newStartAt or newEndAt timestamp format", 
        code: "INVALID_TIMESTAMPS" 
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ 
        error: "New appointment start time must be before end time", 
        code: "INVALID_TIME_RANGE" 
      });
    }

    if (startDate.getTime() <= now) {
      return res.status(400).json({ 
        error: "New appointment slot cannot be in the past or immediately. Please pick an upcoming slot.", 
        code: "PAST_APPOINTMENT" 
      });
    }

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (60 * 1000);
    if (durationMinutes < 15 || durationMinutes > 180) {
      return res.status(400).json({ 
        error: "New appointment duration must be between 15 minutes and 3 hours.", 
        code: "INVALID_DURATION" 
      });
    }

    const maxAdvanceMs = 180 * 24 * 60 * 60 * 1000;
    if (startDate.getTime() > now + maxAdvanceMs) {
      return res.status(400).json({ 
        error: "Appointments cannot be rescheduled more than 180 days in advance.", 
        code: "EXCESSIVE_ADVANCE_BOOKING" 
      });
    }

    const newStart = startDate.getTime();
    const newEnd = endDate.getTime();

    // 1. Property Conflict: Check for conflict on the same property (excluding THIS appointment)
    const propertyConflict = db.appointments.find(a => 
      a._id !== apt._id &&
      (a.propertyId === apt.propertyId || a.property_id === apt.propertyId) &&
      a.status === 'confirmed' &&
      newStart < new Date(a.endAt || a.end_at).getTime() && 
      new Date(a.startAt || a.start_at).getTime() < newEnd
    );

    if (propertyConflict) {
      return res.status(409).json({
        error: "The requested new time slot conflicts with an existing confirmed appointment on this property. Please select another slot.",
        conflictStart: new Date(propertyConflict.startAt || propertyConflict.start_at).toISOString(),
        conflictEnd: new Date(propertyConflict.endAt || propertyConflict.end_at).toISOString(),
        code: "APPOINTMENT_CONFLICT"
      });
    }

    // 2. User Schedule Conflict: The SAME user cannot reschedule into a slot overlapping another of their bookings
    const userConflict = db.appointments.find(a => 
      a._id !== apt._id &&
      (a.buyerId === req.user._id || a.buyer_id === req.user._id) &&
      a.status === 'confirmed' &&
      newStart < new Date(a.endAt || a.end_at).getTime() && 
      new Date(a.startAt || a.start_at).getTime() < newEnd
    );

    if (userConflict) {
      return res.status(409).json({
        error: `The requested new time slot conflicts with another appointment you have scheduled (${userConflict.propertyTitle || 'another property'}). A single user cannot book overlapping bookings.`,
        conflictStart: new Date(userConflict.startAt || userConflict.start_at).toISOString(),
        conflictEnd: new Date(userConflict.endAt || userConflict.end_at).toISOString(),
        code: "USER_OVERLAPPING_BOOKING"
      });
    }

    const previousSlot = {
      startAt: apt.startAt,
      endAt: apt.endAt
    };

    const updated = await db.updateAppointment(apt._id, {
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      status: "confirmed",
      rescheduledFrom: previousSlot,
      rescheduledAt: new Date().toISOString(),
      rescheduledBy: req.user._id,
      notes: notes || apt.notes,
      updatedAt: new Date().toISOString()
    });

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "APPOINTMENT_RESCHEDULED",
      entity: "Appointment",
      entityId: apt._id,
      details: `Site visit for ${apt.propertyTitle} rescheduled from ${new Date(previousSlot.startAt).toLocaleDateString('en-IN')} to ${startDate.toLocaleDateString('en-IN')} at ${startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} by ${req.user.name}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Appointment successfully rescheduled and slot reserved!",
      appointment: updated || { ...apt, startAt: startDate.toISOString(), endAt: endDate.toISOString() }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authoritative Backend Slot Availability Checker:
 * Returns real-time availability of slots for a property on a given date.
 */
exports.getSlotAvailability = (req, res, next) => {
  try {
    const { propertyId, date } = req.query;

    if (!propertyId || !date) {
      return res.status(400).json({ 
        error: "propertyId and date (YYYY-MM-DD) query parameters are required", 
        code: "MISSING_PARAMS" 
      });
    }

    const prop = findPropertyById(propertyId);
    if (!prop) {
      return res.status(404).json({ error: "Property not found", code: "NOT_FOUND" });
    }

    const STANDARD_SLOTS = [
      { id: '10:00-11:00', label: '10:00 AM – 11:00 AM (Morning)', startH: 10, startM: 0, endH: 11, endM: 0 },
      { id: '11:30-12:30', label: '11:30 AM – 12:30 PM (Mid-Day)', startH: 11, startM: 30, endH: 12, endM: 30 },
      { id: '14:00-15:00', label: '02:00 PM – 03:00 PM (Afternoon)', startH: 14, startM: 0, endH: 15, endM: 0 },
      { id: '16:00-17:00', label: '04:00 PM – 05:00 PM (Late Afternoon)', startH: 16, startM: 0, endH: 17, endM: 0 },
      { id: '17:30-18:30', label: '05:30 PM – 06:30 PM (Sunset Viewing)', startH: 17, startM: 30, endH: 18, endM: 30 }
    ];

    const [year, month, day] = String(date).split('-').map(Number);
    if (!year || !month || !day) {
      return res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD.", code: "INVALID_DATE" });
    }

    const now = Date.now();

    // Find confirmed appointments on that property
    const existingConfirmed = db.appointments.filter(a => 
      a.propertyId === propertyId &&
      a.status === 'confirmed'
    );

    const evaluatedSlots = STANDARD_SLOTS.map(slot => {
      const slotStart = new Date(year, month - 1, day, slot.startH, slot.startM, 0);
      const slotEnd = new Date(year, month - 1, day, slot.endH, slot.endM, 0);

      const isPast = slotStart.getTime() <= now;

      const hasConflict = existingConfirmed.some(a => {
        const aStart = new Date(a.startAt).getTime();
        const aEnd = new Date(a.endAt).getTime();
        return slotStart.getTime() < aEnd && aStart < slotEnd.getTime();
      });

      return {
        ...slot,
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        isPast,
        isBooked: hasConflict,
        isAvailable: !isPast && !hasConflict
      };
    });

    res.json({
      success: true,
      propertyId,
      date,
      slots: evaluatedSlots,
      availableCount: evaluatedSlots.filter(s => s.isAvailable).length
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const apt = db.appointments.find(a => a._id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Appointment not found" });

    const allowed = ['completed', 'cancelled', 'confirmed', 'no_show', 'rejected', 'rescheduled', 'scheduled', 'pending'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}. Allowed: ${allowed.join(', ')}`, code: "INVALID_STATUS" });
    }

    const updated = await db.updateAppointment(apt._id, { 
      status, 
      adminModerationNotes: note || `Updated to ${status} by administrator ${req.user.name}`,
      updatedAt: new Date().toISOString()
    });

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: `APPOINTMENT_${status.toUpperCase()}`,
      entity: "Appointment",
      entityId: apt._id,
      details: `Site visit for ${apt.propertyTitle} marked as ${status.toUpperCase()} by ${req.user.name}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: `Appointment marked as ${status.toUpperCase()}`,
      appointment: updated || apt
    });
  } catch (error) {
    next(error);
  }
};

exports.createInquiry = async (req, res, next) => {
  try {
    const { propertyId, message, phone } = req.body;
    const prop = findPropertyById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Enforce central action eligibility
    const eligibility = isPropertyActionEligible(prop, req.user._id);
    if (!eligibility.eligible) {
      if (eligibility.code === 'OWNER_SELF_ACTION') {
        return res.status(400).json({ 
          error: "Property owners cannot send inquiries on their own listings", 
          code: "OWNER_SELF_INQUIRY" 
        });
      }
      return res.status(400).json({ error: eligibility.reason, code: eligibility.code });
    }

    const newInquiry = {
      _id: db.generateId('inq'),
      propertyId: prop._id,
      buyerId: req.user._id,
      ownerId: prop.ownerId,
      propertyTitle: prop.title,
      buyerName: req.user.name,
      buyerPhone: phone || req.user.mobile,
      message: message || "Interested in learning more about this verified property.",
      status: "open",
      createdAt: new Date()
    };

    await db.insertInquiry(newInquiry);

    res.status(201).json({
      success: true,
      message: "Inquiry sent directly to owner. You will receive an alert upon response.",
      inquiry: newInquiry
    });
  } catch (error) {
    next(error);
  }
};

exports.getInquiries = (req, res) => {
  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  let inquiries;

  if (isAdmin) {
    inquiries = db.inquiries;
  } else {
    inquiries = db.inquiries.filter(i => 
      i.buyerId === req.user._id || i.ownerId === req.user._id
    );
  }

  res.json({
    success: true,
    inquiries
  });
};

exports.createCallRequest = (req, res, next) => {
  try {
    const { propertyId, preferredTime, phone, note } = req.body;
    const prop = findPropertyById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Enforce central action eligibility
    const eligibility = isPropertyActionEligible(prop, req.user._id);
    if (!eligibility.eligible) {
      if (eligibility.code === 'OWNER_SELF_ACTION') {
        return res.status(400).json({ 
          error: "Property owners cannot initiate call requests on their own listings", 
          code: "OWNER_SELF_CALL" 
        });
      }
      return res.status(400).json({ error: eligibility.reason, code: eligibility.code });
    }

    if (!db.callRequests) db.callRequests = [];

    // Sanitize and validate contact phone number
    const rawPhone = phone || req.user.mobile || '';
    const cleanPhone = String(rawPhone).trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: "A valid contact phone number with at least 8 digits is required", code: "INVALID_PHONE" });
    }

    const normalizedSlot = typeof preferredTime === 'string' && preferredTime.trim().length > 0 
      ? preferredTime.trim() 
      : "Today afternoon (2:00 PM - 5:00 PM)";

    // Invariant: Multiple DIFFERENT users can book call slots at the same overlapping time (mediation queues support concurrent users)
    // But the SAME user cannot book duplicate / overlapping active call requests for the same preferred window on this property.
    const userDuplicateCall = db.callRequests.find(c => {
      const isSameUser = (c.buyerId === req.user._id || c.buyer_id === req.user._id);
      if (!isSameUser) return false;
      const isActive = (c.status === 'requested' || c.status === 'scheduled' || c.status === 'in_progress');
      if (!isActive) return false;
      const cSlot = (c.preferredTime || '').trim().toLowerCase();
      const newSlot = normalizedSlot.trim().toLowerCase();
      const isSameProp = (c.propertyId === prop._id || c.property_id === prop._id);
      return isSameProp && cSlot === newSlot;
    });

    if (userDuplicateCall) {
      return res.status(409).json({
        error: `You already have an active callback request for ${prop.title} during "${normalizedSlot}". Our administrator or owner will call you during this window.`,
        code: "USER_DUPLICATE_CALL_REQUEST"
      });
    }

    const newCallRequest = {
      _id: db.generateId('call'),
      propertyId: prop._id,
      buyerId: req.user._id,
      ownerId: prop.ownerId,
      propertyTitle: prop.title,
      buyerName: req.user.name,
      buyerPhone: cleanPhone,
      preferredTime: normalizedSlot,
      note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : "Wants direct phone consultation regarding registered deed & price",
      status: "requested",
      createdAt: new Date()
    };

    db.callRequests.push(newCallRequest);

    res.status(201).json({
      success: true,
      message: "Call request logged successfully! Owner & verified liaison will call you shortly.",
      callRequest: newCallRequest
    });
  } catch (error) {
    next(error);
  }
};

exports.getCallRequests = (req, res) => {
  if (!db.callRequests) db.callRequests = [];
  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  let calls;
  if (isAdmin) {
    calls = db.callRequests;
  } else {
    calls = db.callRequests.filter(c => 
      c.buyerId === req.user._id || c.ownerId === req.user._id ||
      (req.user.email && (c.customerEmail === req.user.email || c.buyerEmail === req.user.email || c.email === req.user.email)) ||
      (req.user.mobile && (c.customerPhone === req.user.mobile || c.buyerPhone === req.user.mobile || c.phone === req.user.mobile))
    );
  }
  const processedCalls = (calls || []).map(c => {
    let updated = { ...c };
    if (!updated.customerName || !updated.customerPhone) {
      const buyer = (db.users || []).find(u => u._id === (c.buyerId || c.buyer_id));
      if (buyer) {
        if (!updated.customerName) updated.customerName = c.buyerName || buyer.name;
        if (!updated.customerPhone) updated.customerPhone = c.buyerPhone || buyer.mobile;
        if (!updated.customerEmail) updated.customerEmail = c.buyerEmail || buyer.email;
      } else {
        if (!updated.customerName && c.buyerName) updated.customerName = c.buyerName;
        if (!updated.customerPhone && c.buyerPhone) updated.customerPhone = c.buyerPhone;
      }
    }
    return updated;
  });

  res.json({
    success: true,
    callRequests: processedCalls
  });
};

exports.updateCallRequestStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!db.callRequests) db.callRequests = [];
    const call = db.callRequests.find(c => c._id === req.params.id);
    if (!call) return res.status(404).json({ error: "Call request not found" });

    const allowed = ['completed', 'cancelled', 'in_progress', 'requested', 'follow_up', 'rejected', 'missed', 'pending', 'scheduled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}. Allowed: ${allowed.join(', ')}`, code: "INVALID_STATUS" });
    }

    call.status = status;
    call.updatedAt = new Date().toISOString();
    if (note) call.adminNotes = note;

    if (db.insertAuditLog) {
      await db.insertAuditLog({
        _id: db.generateId('log'),
        actorId: req.user._id,
        actorName: req.user.name,
        action: `CALL_REQUEST_${status.toUpperCase()}`,
        entity: "CallRequest",
        entityId: call._id,
        details: `Mediation call for ${call.propertyTitle} marked as ${status.toUpperCase()} by ${req.user.name}`,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: `Call request marked as ${status.toUpperCase()}`,
      callRequest: call
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleFavorite = (req, res) => {
  const { propertyId } = req.body;
  const prop = findPropertyById(propertyId);
  if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(propertyId))) {
    return res.status(404).json({ error: "Property listing not found or has been removed", code: "NOT_FOUND" });
  }

  if (!db.favorites) db.favorites = [];
  
  const existingIndex = db.favorites.findIndex(f => f.userId === req.user._id && f.propertyId === propertyId);
  let favorited = false;
  if (existingIndex >= 0) {
    db.favorites.splice(existingIndex, 1);
    favorited = false;
  } else {
    db.favorites.push({
      _id: db.generateId('fav'),
      userId: req.user._id,
      propertyId,
      createdAt: new Date()
    });
    favorited = true;
  }

  res.json({
    success: true,
    favorited,
    propertyId
  });
};

exports.getFavorites = (req, res) => {
  if (!db.favorites) db.favorites = [];
  const userFavIds = db.favorites.filter(f => f.userId === req.user._id).map(f => f.propertyId);
  const favoriteProperties = db.properties.filter(p => userFavIds.includes(p._id) && !p.isRemoved && p.status !== 'removed');
  res.json({
    success: true,
    favorites: favoriteProperties,
    favoriteIds: userFavIds
  });
};

