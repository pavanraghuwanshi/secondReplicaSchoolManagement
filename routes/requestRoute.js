const express = require('express');
const router = express.Router();
const { jwtAuthMiddleware } = require('../jwt');
const Request = require('../models/request');
const Child = require('../models/child');
const { createAndSendNotification } = require('../utils/notificationWebSocket');

// Helper function to generate absences between two dates
function generateAbsences(startDate, endDate) {
  const absences = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  while (currentDate <= end) {
    absences.push({
      date: new Date(currentDate),
      isAbsent: true,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return absences;
}

// Create a new request
router.post('/create-request', async (req, res) => {
  try {
    const {
      childId,
      reason,
      requestType,
      startDate,
      endDate,
      newRoute
    } = req.body;

    // Validate required fields
    if (!childId || !reason || !requestType) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    // Validate request type
    if (!['leave', 'changeRoute'].includes(requestType)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    // Validate specific fields based on request type
    if (requestType === 'leave' && (!startDate || !endDate)) {
      return res.status(400).json({ error: 'Start date and end date are required for leave requests' });
    }

    if (requestType === 'changeRoute' && !newRoute) {
      return res.status(400).json({ error: 'New route is required for change route requests' });
    }

    // Fetch child to get parentId, schoolId, and branchId
    const child = await Child.findById(childId).populate('parentId', 'schoolId branchId');
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const parentId = child.parentId._id;
    const schoolId = child.schoolId;
    const branchId = child.branchId;

    // Create a new request
    const newRequest = new Request({
      parentId,
      childId,
      reason,
      requestType,
      startDate: requestType === 'leave' ? new Date(startDate) : undefined,
      endDate: requestType === 'leave' ? new Date(endDate) : undefined,
      newRoute: requestType === 'changeRoute' ? newRoute : undefined,
      schoolId,
      branchId,
      statusOfRequest: 'pending', // Default status
      requestDate: new Date()
    });

    await newRequest.save();

    // Code for web notifications
    createAndSendNotification(branchId, childId, reason, requestType);

    res.status(201).json({ message: 'Request created successfully', request: newRequest });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
