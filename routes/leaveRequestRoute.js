const express = require("express");
const LeaveRequest = require("../models/leaveRequest");
const {jwtAuthMiddleware } = require('../jwt');

const router = express.Router();

router.use(jwtAuthMiddleware);
// Create a leave request


router.post('/request-leave', async (req, res) => {
  try {
    const { childName, startDate, endDate, reason } = req.body;
    const childId = req.user.id;  // Extracted from JWT token

    if (!childName || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Child name, start date, end date, and reason are required' });
    }

    // Create a new leave request
    const leaveRequest = new LeaveRequest({
      childId,  
      childName,
      startDate,
      endDate,
      reason
    });

    await leaveRequest.save();
    res.status(201).json({ success: true, leaveRequest });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
