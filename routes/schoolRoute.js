const express = require("express");
const router = express.Router();
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const Child = require('../models/child');
const Request = require('../models/request');
const Parent = require("../models/Parent");
const Driver = require("../models/driver");
const Attendance = require('../models/attendence');
const { schoolAuthMiddleware } = require('../jwt');
// School Registration Route
router.post('/register', async (req, res) => {
  const { schoolName, username, password } = req.body;

  try {
    const existingSchool = await School.findOne({ username });
    if (existingSchool) {
      return res.status(400).json({ error: 'School username already exists' });
    }
    const newSchool = new School({ schoolName, username, password });
    await newSchool.save();

    res.status(201).json({ message: 'School registered successfully' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// School Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const school = await School.findOne({ username });
    if (!school) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Compare password using the schema method
    const isMatch = await school.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: school._id, username: school.username }, process.env.JWT_SECRET);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Assign Vehicle ID to Child
router.post("/admin/assignVehicleId", async (req, res) => {
  const { childId, vehicleId } = req.body;
  try {
    await Child.findByIdAndUpdate(childId, { vehicleId });
    res.send({ message: "Vehicle ID assigned successfully", vehicleId });
  } catch (error) {
    res.status(500).send({ error: "Failed to assign Vehicle ID" });
  }
});
// Update Vehicle ID for Child
router.put("/child/updateVehicleId", async (req, res) => {
  const { childId, vehicleId } = req.body;
  try {
    await Child.findByIdAndUpdate(childId, { vehicleId });
    res.send({ message: "Vehicle ID updated successfully", vehicleId });
  } catch (error) {
    res.status(500).send({ error: "Failed to update Vehicle ID" });
  }
});
// Get request data
router.get('/getrequestdata', schoolAuthMiddleware, async (req, res) => {
  try {
    const requests = await Request.find({})
      .populate({
        path: 'childId',
        select: 'childName class section parentId',
        populate: {
          path: 'parentId',
          select: 'parentName phone'
        }
      })
      .lean();

    const transformedRequests = requests.map(request => {
      const child = request.childId || {};
      const parent = child.parentId || {};

      return {
        _id: request._id,
        childName: child.childName,
        class: child.class,
        section: child.section,
        parentName: parent.parentName || null,
        phone: parent.phone || null,
        requestType: request.requestType || null,
        reason: request.reason || null,
        date: request.date || null
      };
    });

    console.log('Transformed request data:', JSON.stringify(transformedRequests, null, 2));
    res.status(200).json({ requests: transformedRequests });
  } catch (error) {
    console.error('Error fetching request data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get children with vehicle IDs
router.get("/read/all-children", schoolAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({}).lean();
    console.log("Raw children data:", JSON.stringify(children, null, 2));

    const transformedChildren = await Promise.all(
      children.map(async (child) => {
        let parentData = {};
        if (child.parentId) {
          const parent = await Parent.findById(child.parentId).lean();
          console.log("Parent data:", JSON.stringify(parent, null, 2));

          parentData = {
            parentName: parent ? parent.parentName : null,
            email: parent ? parent.email : null,
            phone: parent ? parent.phone : null,
            parentId: parent ? parent._id : null,
          };
        } else {
          parentData = {
            parentName: null,
            email: null,
            phone: null,
            parentId: null,
          };
        }

        return {
          ...child,
          ...parentData,
        };
      })
    );

    console.log("Transformed children data:", JSON.stringify(transformedChildren, null, 2));
    res.status(200).json({ children: transformedChildren });
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Update child
router.put('/update/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const {
    childName,
    class: childClass,
    rollno,
    section,
    schoolName,
    dateOfBirth,
    childAge,
    gender,
    parentName,
    email,
    phone
  } = req.body;

  // Separate childData and parentData from the request body
  const childData = {
    childName,
    class: childClass,
    rollno,
    section,
    schoolName,
    dateOfBirth,
    childAge,
    gender
  };

  const parentData = {
    parentName,
    email,
    phone
  };

  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Update child data
    const updatedChild = await Child.findByIdAndUpdate(childId, childData, { new: true }).lean();
    console.log('Updated child data:', JSON.stringify(updatedChild, null, 2));

    let response = { child: updatedChild };

    // If parent data is provided and child has a parentId, update parent data
    if ((parentData.parentName || parentData.email || parentData.phone) && child.parentId) {
      const updatedParent = await Parent.findByIdAndUpdate(child.parentId, parentData, { new: true }).lean();
      console.log('Updated parent data:', JSON.stringify(updatedParent, null, 2));

      response.child.parentName = updatedParent.parentName;
      response.child.email = updatedParent.email;
      response.child.phone = updatedParent.phone;
      response.child.parentId = updatedParent._id;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Delete child
router.delete('/delete/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    let parentData = {};
    if (child.parentId) {
      const parent = await Parent.findById(child.parentId).lean();
      if (parent) {
        parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id
        };
        const childCount = await Child.countDocuments({ parentId: child.parentId });
        if (childCount === 1) {
          await Parent.findByIdAndDelete(child.parentId);
        }
      }
    }
    await Child.findByIdAndDelete(childId);
    console.log('Deleted child data:', JSON.stringify(child, null, 2));
    if (parentData.parentId) {
      console.log('Associated parent data:', JSON.stringify(parentData, null, 2));
    }

    res.status(200).json({ 
      message: 'Child deleted successfully',
      child,
      parent: parentData 
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get attendance records for a specific child
router.get('/attendance/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }
    const records = await Attendance.find({ childId }).sort({ date: -1 }).lean();
    if (records.length === 0) {
      return res.status(404).json({ message: 'No attendance records found for this child' });
    }
    const response = {
      childName: child.childName,
      attendanceRecords: records
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get all pending requests
router.get('/pending-requests', schoolAuthMiddleware, async (req, res) => {
  try {
    const requests = await Request.find({ statusOfRequest: 'pending' })
      .populate('parentId', 'parentName email')
      .populate('childId', 'childName vehicleId')
      .lean();

    const formattedRequests = requests.map(request => ({
      requestId: request._id,
      statusOfRequest: request.statusOfRequest,
      parentId: request.parentId._id,
      parentName: request.parentId.parentName,
      email: request.parentId.email,
      childId: request.childId._id,
      childName: request.childId.childName,
      vehicleId: request.childId.vehicleId
    }));

    res.status(200).json({ 
      requests: formattedRequests 
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});
//review request
router.post('/review-request/:requestId', schoolAuthMiddleware, async (req, res) => {
  try {
    const { statusOfRequest } = req.body;
    const { requestId } = req.params;

    if (!['approved', 'denied'].includes(statusOfRequest)) {
      return res.status(400).json({ error: 'Invalid statusOfRequest' });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.statusOfRequest = statusOfRequest;

    if (statusOfRequest === 'approved' && request.requestType === 'changeRoute') {
      const child = await Child.findById(request.childId);
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }
      child.vehicleId = request.newRoute;
      await child.save();
    }
    await request.save();

    // Assuming notifyParent is a function to send notifications
    const notifyParent = (parentId, message) => {
      // Your notification logic here
      console.log(`Notification to parentId ${parentId}: ${message}`);
    };

    notifyParent(request.parentId, `Your request has been ${statusOfRequest}.`);

    res.status(200).json({ message: 'Request reviewed successfully', request });
  } catch (error) {
    console.error('Error reviewing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read/alldrivers',schoolAuthMiddleware, async (req, res) => {
  try {
    const drivers = await Driver.find({});
    console.log("Raw drivers data:", JSON.stringify(drivers, null, 2));
    res.status(200).json({ drivers });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = router;
