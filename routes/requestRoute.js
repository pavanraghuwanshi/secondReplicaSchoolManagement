const express = require("express");
const router = express.Router();
const Request = require("../models/request");
const { jwtAuthMiddleware } = require("../jwt");
const Child = require("../models/child");

// Create Request Route
router.post('/create-request', jwtAuthMiddleware, async (req, res) => {
  try {
    const { requestType, startDate, endDate, childId, reason, isAbsent } = req.body;
    const parentId = req.user.id;

    if (!['leave', 'pickup', 'drop', 'absent'].includes(requestType)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    if (requestType === 'leave') {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required for leave requests' });
      }
    } else if (requestType === 'pickup' || requestType === 'drop') {
      if (!startDate) {
        return res.status(400).json({ error: 'Date is required for pickup or drop requests' });
      }
    } else if (requestType === 'absent') {
      if (isAbsent === undefined) {
        return res.status(400).json({ error: 'Boolean value is required for absent requests' });
      }
    }
    const child = await Child.findOne({ _id: childId, parentId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent' });
    }
    const newRequest = new Request({
      requestType,
      startDate: requestType !== 'absent' ? startDate : null,
      endDate: requestType === 'leave' ? endDate : null,
      parentId,
      childId,
      reason,
      ...(requestType === 'absent' ? { isAbsent } : {})
    });
    

    await newRequest.save();
    res.status(201).json({
      request: {
        requestType: newRequest.requestType,
        startDate: newRequest.startDate,
        endDate: newRequest.endDate,
        parentId: newRequest.parentId,
        childId: newRequest.childId,
        reason: newRequest.reason,
        ...(newRequest.isAbsent !== undefined ? { isAbsent: newRequest.isAbsent } : {})
      }
    });
    
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
