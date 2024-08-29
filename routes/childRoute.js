const express = require("express");
const Parent = require("../models/Parent");
const Child = require("../models/child");
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const router = express.Router();
require('dotenv').config();
const Attendance = require('../models/attendence')
const Request = require("../models/request");
const School = require("../models/school");

// Parent Registration Route
router.post('/register', async (req, res) => {
  try {
    const {
      parentName,
      email,
      password,
      phone,
      childName,
      class: childClass,
      rollno,
      section,
      schoolName,
      dateOfBirth,
      childAge,
      gender,
      fcmToken,
      pickupPoint,
      busName,deviceId
    } = req.body;

    console.log(`Registering parent with schoolName: "${schoolName.trim()}"`);

    // Check if parent email already exists
    const existingParent = await Parent.findOne({ email });
    if (existingParent) {
      return res.status(400).json({ error: 'Parent email already exists' });
    }

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') });

    if (!school) {
      console.log('School not found:', schoolName.trim());
      return res.status(400).json({ error: 'School not found' });
    }

    // Create new parent with a pending status
    const newParent = new Parent({
      parentName,
      email,
      password, // No need to hash here, it will be done in the schema
      phone,
      fcmToken,
      schoolId: school._id ,
      statusOfRegister: 'pending'
    });
    await newParent.save();

    // Create new child linked to the school and parent
    const newChild = new Child({
      childName,
      parentName,
      email,
      class: childClass,
      rollno,
      section,
      schoolName,
      schoolId: school._id, // Link to the school's ID
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      busName,
      deviceId,
      parentId: newParent._id
    });
    await newChild.save();

    // Link child to parent
    newParent.children.push(newChild._id);
    await newParent.save();

    // Generate JWT token
    const payload = { id: newParent._id, email: newParent.email, schoolId: school._id };
    const token = generateToken(payload);

    res.status(201).json({ parent: newParent, child: newChild, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Fetch School List Route
router.get('/getschools', async (req, res) => {
  try {
    const schools = await School.find({}, 'schoolName');
    res.status(200).json({ schools });
  } catch (error) {
    console.error('Error fetching school list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Parent Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const parent = await Parent.findOne({ email });

    // Check if parent exists
    if (!parent) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare provided password with stored hashed password
    const isMatch = await parent.comparePassword(password);

    // Check if password matches
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT token with parent ID, email, and schoolId
    const token = generateToken({
      id: parent._id,
      email: parent.email,
      schoolId: parent.schoolId, // Add schoolId to the token payload
    });

    // Send success response with token
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put('/update-pickup-point', jwtAuthMiddleware, async (req, res) => {
  try {
    const { childId, pickupPoint } = req.body;
    const { schoolId } = req; // Assuming `schoolId` is attached to the request by jwtAuthMiddleware

    // Validate input
    if (!childId || !pickupPoint) {
      return res.status(400).json({ error: 'Child ID and pickup point are required' });
    }

    // Find the child by ID and ensure they belong to the correct school
    const updatedChild = await Child.findOneAndUpdate(
      { _id: childId, schoolId: schoolId }, // Match by childId and schoolId
      { pickupPoint },
      { new: true, runValidators: true }
    );

    // Check if the child was found and updated
    if (!updatedChild) {
      return res.status(404).json({ error: 'Child not found or does not belong to this school' });
    }

    res.status(200).json({ message: 'Pickup point updated successfully', child: updatedChild });
  } catch (error) {
    console.error('Error updating pickup point:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Add Child Route
router.post('/add-child', jwtAuthMiddleware, async (req, res) => {
  try {
    const {
      childName,
      class: childClass,
      rollno,
      section,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      busName,
      deviceId,
      schoolName // Make sure to extract schoolName from the request body
    } = req.body;

    // Extract parentId from the JWT token payload
    const parentId = req.user.id;

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') });

    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    // Create new child with the parentId and schoolId
    const newChild = new Child({
      childName,
      class: childClass,
      rollno,
      section,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      busName,
      deviceId,
      parentId,
      schoolId: school._id, // Add the found schoolId to the child record
      schoolName: school.schoolName // Ensure the correct schoolName is associated
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
    const schoolId = req.user.schoolId; // Assuming schoolId is in the JWT payload
    
    // Fetch the parent data and populate children that match the schoolId
    const parent = await Parent.findById(parentId).populate({
      path: 'children',
      match: { schoolId: schoolId } // Filter children by schoolId
    });
    
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Convert children documents to plain objects
    const childrenData = parent.children.map(child => child.toObject());

    // Respond with children data
    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error('Error fetching child data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Parent Data 
router.get('/get-parent-data', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is in the JWT payload
    
    // Find the parent by ID and exclude the password field
    const parent = await Parent.findById(parentId).select('-password');

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Check if the schoolId matches
    if (parent.schoolId.toString() !== schoolId) {
      return res.status(403).json({ error: 'Unauthorized access to this school data' });
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
    const schoolId = req.schoolId;

    // Find the child by ID, parentId, and schoolId
    const child = await Child.findOne({ _id: childId, parentId, schoolId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent or school' });
    }

    // Update the child details
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
router.put("/update-parent/:parentId", jwtAuthMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { parentName, email, phone } = req.body;

    // Ensure the authenticated parent is the one being updated
    if (parentId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only update your own profile' });
    }

    // Find the parent by ID and ensure they belong to the correct school (if applicable)
    const parent = await Parent.findOne({ _id: parentId, schoolId: req.schoolId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or incorrect token' });
    }

    // Update the parent's details
    parent.parentName = parentName || parent.parentName;
    parent.email = email || parent.email;
    parent.phone = phone || parent.phone;

    await parent.save();

    res.status(200).json({ parent });
  } catch (error) {
    console.error('Error during updating parent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//get requests of parents 
router.get('/getrequests', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const schoolId = req.user.schoolId; // Get the schoolId from the authenticated user

    // Fetch the parent data along with their children, ensuring the correct school context
    const parent = await Parent.findOne({ _id: parentId, schoolId }).populate('children', '_id childName');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to the authenticated school' });
    }

    // Collect all child IDs
    const childIds = parent.children.map(child => child._id);

    // Fetch all requests for the children, ensuring the requests are within the same school context
    const requests = await Request.find({ childId: { $in: childIds }, schoolId })
      .select('requestType startDate endDate reason newRoute childId requestDate')
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
            endDate: request.endDate,
            requestDate: request.requestDate
          };
        }
      } else {
        groupedRequests.push({
          childName: request.childId.childName,
          date: request.startDate, 
          requestType: request.requestType,
          reason: request.reason,
          newRoute: request.newRoute,
          requestDate: request.requestDate
        });
      }
    });

    // Include leave requests in the grouped response
    Object.values(leaveRequests).forEach(leaveRequest => groupedRequests.push(leaveRequest));

    res.status(200).json({ requests: groupedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/status/:childId', jwtAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const parentId = req.user.id;
  const schoolId = req.user.schoolId;

  try {
    const child = await Child.findOne({ _id: childId, parentId, schoolId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent/school' });
    }

    const today = new Date();
    const formattedToday = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

    const attendanceRecord = await Attendance.findOne({ childId, date: formattedToday, schoolId });
    
    if (!attendanceRecord) {
      return res.status(200).json({
        childId: childId,
        pickupStatus: null,
        dropStatus: null,
        date: null,
        pickupTime: null,
        dropTime: null
      });
    }

    res.status(200).json({
      childId: childId,
      pickupStatus: attendanceRecord.pickup || null,
      dropStatus: attendanceRecord.drop || null,
      date: attendanceRecord.date || null,
      pickupTime: attendanceRecord.pickupTime || null,
      dropTime: attendanceRecord.dropTime || null
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





module.exports = router;
