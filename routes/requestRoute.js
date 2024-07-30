const express = require('express');
const router = express.Router();
const {jwtAuthMiddleware} = require('../jwt');
const Request = require('../models/request')
const Child = require('../models/child')

// Helper functions for date parsing and formatting
function parseDDMMYYYYToDate(dateStr) {
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
function generateAbsences(startDate, endDate) {
  const absences = [];
  let currentDate = parseDDMMYYYYToDate(startDate);
  const parsedEndDate = parseDDMMYYYYToDate(endDate);
  while (currentDate <= parsedEndDate) {
    absences.push({
      date: formatDateToDDMMYYYY(currentDate),
      isAbsent: true // true if the child is absent
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
      startDate: requestType === 'leave' ? formatDateToDDMMYYYY(parseDDMMYYYYToDate(startDate)) : undefined,
      endDate: requestType === 'leave' ? formatDateToDDMMYYYY(parseDDMMYYYYToDate(endDate)) : undefined,
      parentId,
      childId,
      reason,
      newRoute: requestType === 'changeRoute' ? newRoute : undefined,
      absences: requestType === 'leave' ? generateAbsences(startDate, endDate) : []
    });

    if (requestType === 'changeRoute') {
      // Update the child's vehicle ID
      child.vehicleId = newRoute;
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
