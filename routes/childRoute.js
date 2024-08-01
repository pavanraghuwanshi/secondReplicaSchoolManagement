const express = require("express");
const bcrypt = require("bcrypt");
const Parent = require("../models/Parent");
const Child = require("../models/child");
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const router = express.Router();
require('dotenv').config();
const Request = require("../models/request");

// Parent Registration Route
router.post('/register', async (req, res) => {
  try {
    const { parentName, email, password, phone, childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender, fcmToken } = req.body;

    // Check if parent email already exists
    const existingParent = await Parent.findOne({ email });
    if (existingParent) {
      return res.status(400).json({ error: 'Parent email already exists' });
    }
    
    // Create new parent
    const newParent = new Parent({ parentName, email, password, phone, fcmToken });
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
    const { childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender } = req.body;

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
      parentId 
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
    const parent = await Parent.findById(parentId).populate('children');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    res.status(200).json({ children: parent.children });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get Parent Data Route
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


module.exports = router;
