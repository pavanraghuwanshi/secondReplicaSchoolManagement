const express = require("express");
const router = express.Router();
const Request = require("../models/request");
const { jwtAuthMiddleware } = require("../jwt");
const Child = require("../models/child");
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function parseDDMMYYYYToDate(dateString) {
  const [day, month, year] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // Months are zero-based in JS Date
}

router.post('/create-request', jwtAuthMiddleware, async (req, res) => {
  try {
    const { requestType, startDate, endDate, reason, isAbsent, childId } = req.body;
    const parentId = req.user.id;

    if (!childId) {
      return res.status(400).json({ error: 'Child ID is required' });
    }

    if (!['leave', 'pickup', 'drop', 'absent'].includes(requestType)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    if (requestType === 'leave') {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required for leave requests' });
      }
    } else if (['pickup', 'drop'].includes(requestType)) {
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

    const parsedStartDate = parseDDMMYYYYToDate(startDate);
    const parsedEndDate = endDate ? parseDDMMYYYYToDate(endDate) : null;

    const newRequest = new Request({
      requestType,
      startDate: requestType !== 'absent' ? formatDateToDDMMYYYY(parsedStartDate) : formatDateToDDMMYYYY(new Date()), // Assign today's date if absent
      endDate: requestType === 'leave' ? formatDateToDDMMYYYY(parsedEndDate) : null,
      parentId,
      childId,
      reason,
      ...(requestType === 'absent' ? { isAbsent } : {})
    });

    await newRequest.save();

    // If the request is a leave request, mark the child as absent or present for the specified dates
    if (requestType === 'leave') {
      const absences = [];
      let currentDate = parsedStartDate;
      while (currentDate <= parsedEndDate) {
        absences.push({
          date: formatDateToDDMMYYYY(currentDate),
          isAbsent: true // true if the child is absent
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      newRequest.absences = absences;
      await newRequest.save();
    }

    res.status(201).json({
      request: {
        requestType: newRequest.requestType,
        startDate: newRequest.startDate,
        endDate: newRequest.endDate,
        parentId: newRequest.parentId,
        childId: newRequest.childId,
        reason: newRequest.reason,
        absences: newRequest.absences || [],
        ...(newRequest.isAbsent !== undefined ? { isAbsent: newRequest.isAbsent } : {})
      }
    });

  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




module.exports = router;
