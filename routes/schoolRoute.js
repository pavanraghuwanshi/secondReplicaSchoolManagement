const express = require("express");
const router = express.Router();
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const Child = require('../models/child')
const Request= require('../models/request');
const Parent = require('../models/parent');
const Attendance = require('../models/attendence');
const {schoolAuthMiddleware} = require('../jwt');

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
// get request data
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
// get children
router.get('/read/all-children', schoolAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({}).lean(); 
    console.log('Raw children data:', JSON.stringify(children, null, 2));
    
    const transformedChildren = await Promise.all(children.map(async child => {
      let parentData = {};
      if (child.parentId) {
        const parent = await Parent.findById(child.parentId).lean();
        console.log('Parent data:', JSON.stringify(parent, null, 2)); 
        
        parentData = {
          parentName: parent ? parent.parentName : null,
          email: parent ? parent.email : null,
          phone: parent ? parent.phone : null,
          parentId: parent ? parent._id : null 
        };
      } else {
        parentData = {
          parentName: null,
          email: null,
          phone: null,
          parentId: null 
        };
      }

      return {
        ...child,
        ...parentData 
      };
    }));

    console.log('Transformed children data:', JSON.stringify(transformedChildren, null, 2));
    res.status(200).json({ children: transformedChildren });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// update child
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
// delete child
router.delete('/delete/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;

  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Optionally, handle parent data before deleting the child
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

        // Optionally, you could also delete the parent if needed
        // await Parent.findByIdAndDelete(child.parentId);
      }
    }

    // Delete the child
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
router.get('/attendance/:childId',  async (req, res) => {
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
module.exports = router;