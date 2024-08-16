const express = require("express");
const bcrypt = require("bcrypt");
const Parent = require("../models/Parent");
const Child = require("../models/child");
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const router = express.Router();
const Geofencing = require('../models/geofence')
require('dotenv').config();
const Attendance = require('../models/attendence')
const Request = require("../models/request");


// Parent Registration Route
router.post('/register', async (req, res) => {
  try {
    const {parentName, email, password, phone, childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender, fcmToken, pickupPoint} = req.body;

    // Check if parent email already exists
    const existingParent = await Parent.findOne({ email });
    if (existingParent) {
      return res.status(400).json({ error: 'Parent email already exists' });
    }
    
    // Create new parent
    // const newParent = new Parent({ parentName, email, password, phone, fcmToken });
    // await newParent.save();
    // Create new parent with a pending status
    const newParent = new Parent({ parentName, email, password, phone, fcmToken, statusOfRegister : 'pending' });
    await newParent.save();

    // Create new child
    const newChild = new Child({
      childName,
      parentName,
      email,
      class: childClass,
      rollno,
      section,
      schoolName,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      parentId: newParent._id
    });
    await newChild.save();

    // Link child to parent
    newParent.children.push(newChild._id);
    await newParent.save();

    // Generate JWT token
    const payload = { id: newParent._id, email: newParent.email };
    const token = generateToken(payload);

    res.status(201).json({ parent: newParent, child: newChild, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Parent Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const parent = await Parent.findOne({ email });
    if (!parent) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await parent.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT token for the parent
    const token = generateToken({ id: parent._id, email: parent.email });
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: "Server error" });
  }
});
// Add Child Route
router.post('/add-child', jwtAuthMiddleware, async (req, res) => {
  try {
    const { childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender, pickupPoint } = req.body;

    // Extract parentId from the JWT token payload
    const parentId = req.user.id;

    // Create new child with the parentId
    const newChild = new Child({
      childName,
      class: childClass,
      rollno,
      section,
      schoolName,
      dateOfBirth,
      childAge,
      gender,
      parentId ,
      pickupPoint
    });

    await newChild.save();

    // Add child to the parent’s children list
    await Parent.findByIdAndUpdate(parentId, { $push: { children: newChild._id } });

    res.status(201).json({ child: newChild });

  } catch (error) {
    console.error('Error during adding child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get Children List Route
router.get('/getchilddata', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    // Fetch the parent data and populate children
    const parent = await Parent.findById(parentId).populate('children');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    // Fetch geofencing data for each child's deviceId
    const geofencingDataPromises = parent.children.map(async (child) => {
      const geofencingData = await Geofencing.find({ deviceId: child.deviceId }).lean();
      if (!geofencingData.length) {
        return {
          id: null,
          name: "No geofencing data available",
          description: "",
          area: "",
          calendarId: null,
          attributes: {},
          isCrossed:false
        };
      }
      return geofencingData;
    });
    const geofencingDataResults = await Promise.all(geofencingDataPromises);
    // Map the geofencing data to children
    const childrenWithGeofencing = parent.children.map((child, index) => ({
      ...child.toObject(), // Convert child document to plain object
      geofencing: geofencingDataResults[index]
    }));
    // Respond with children and their geofencing data
    res.status(200).json({ children: childrenWithGeofencing });
  } catch (error) {
    console.error('Error fetching child data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get Parent Data 
router.get('/get-parent-data', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const parent = await Parent.findById(parentId).select('-password'); // Exclude password field

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    res.status(200).json({ parent });
  } catch (error) {
    console.error('Error fetching parent data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Update Child Route
router.put('/update-child/:childId', jwtAuthMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const { childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender } = req.body;
    const parentId = req.user.id;
    const child = await Child.findOne({ _id: childId, parentId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent' });
    }
    child.childName = childName || child.childName;
    child.class = childClass || child.class;
    child.rollno = rollno || child.rollno;
    child.section = section || child.section;
    child.schoolName = schoolName || child.schoolName;
    child.dateOfBirth = dateOfBirth || child.dateOfBirth;
    child.childAge = childAge || child.childAge;
    child.gender = gender || child.gender;

    await child.save();

    res.status(200).json({ child });
  } catch (error) {
    console.error('Error during updating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Update parent Route
router.put("/update-parent/:parentId",jwtAuthMiddleware,async(req,res)=>{
  try {
    const { parentId } = req.params;
    const { parentName, email, phone} = req.body;
    const parent = await Parent.findOne({ _id:parentId });
    if (!parent) {
      return res.status(404).json({ error: 'incorrect token' });
    }
    parent.parentName = parentName || parent.parentName;
    parent.email = email || parent.email;
    parent.phone = phone || parent.phone;
    await parent.save();
    res.status(200).json({ parent});
  } catch (error) {
    console.error('Error during updating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})
// get requests
router.get('/requests', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;  // Extract parentId from the JWT token payload

    // Find all requests for the parent’s children
    const requests = await Request.find({ parentId }).populate('childId');

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/parent-requests', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;

    // Fetch the parent data along with their children
    const parent = await Parent.findById(parentId).populate('children', '_id childName');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Collect all child IDs
    const childIds = parent.children.map(child => child._id);

    // Fetch all requests for the children
    const requests = await Request.find({ childId: { $in: childIds } })
      .select('requestType startDate endDate reason childId')
      .populate('childId', 'childName');

    // Group the requests
    const groupedRequests = [];
    const leaveRequests = {};

    requests.forEach(request => {
      if (request.requestType === 'leave') {
        const childId = request.childId._id;
        if (!leaveRequests[childId]) {
          leaveRequests[childId] = {
            childName: request.childId.childName,
            requestType: 'leave',
            reason: request.reason,
            startDate: request.startDate,
            endDate: request.endDate
          };
        }
      } else {
        groupedRequests.push({
          childName: request.childId.childName,
          date: request.startDate,  // Assuming 'date' refers to the start date
          requestType: request.requestType,
          reason: request.reason
        });
      }
    });

    // Add the grouped leave requests
    Object.values(leaveRequests).forEach(leaveRequest => groupedRequests.push(leaveRequest));

    res.status(200).json({ requests: groupedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// get status
router.get('/status/:childId', jwtAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  try {
    // Find the most recent attendance record for the given child
    const attendanceRecord = await Attendance.findOne({ childId }).sort({ date: -1 });

    if (!attendanceRecord) {
      return res.status(404).json({ error: 'No attendance record found for this child' });
    }
    // Send response with only the isPresent boolean values for pickup and drop
    res.status(200).json({
      childId: childId,
      pickupStatus: attendanceRecord.pickup, 
      dropStatus: attendanceRecord.drop,     
      date: attendanceRecord.date,            
      pickupTime: attendanceRecord.pickupTime,
      dropTime: attendanceRecord.dropTime
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
