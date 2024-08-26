const express = require('express');
const router = express.Router();
const { jwtAuthMiddleware } = require('../jwt');
const Request = require('../models/request');
const Child = require('../models/child');

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

router.post('/create-request', jwtAuthMiddleware, async (req, res) => {
  try {
    const { requestType, startDate, endDate, reason, childId, newRoute } = req.body;
    const parentId = req.user.id;

    if (!childId) {
      return res.status(400).json({ error: 'Child ID is required' });
    }

    if (!['leave', 'changeRoute'].includes(requestType)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    if (requestType === 'leave' && (!startDate || !endDate)) {
      return res.status(400).json({ error: 'Start date and end date are required for leave requests' });
    }

    if (requestType === 'changeRoute' && !newRoute) {
      return res.status(400).json({ error: 'New route is required for change route requests' });
    }

    const child = await Child.findOne({ _id: childId, parentId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent' });
    }

    const newRequest = new Request({
      requestType,
      startDate: requestType === 'leave' ? new Date(startDate) : undefined,
      endDate: requestType === 'leave' ? new Date(endDate) : undefined,
      parentId,
      childId,
      reason,
      newRoute: requestType === 'changeRoute' ? newRoute : undefined,
      absences: requestType === 'leave' ? generateAbsences(new Date(startDate), new Date(endDate)) : [],
    });

    if (requestType === 'changeRoute') {
      // Update the child's route
      child.deviceId = newRoute;
      await child.save();
    }

    await newRequest.save();
    res.status(201).json({ request: newRequest });

  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
