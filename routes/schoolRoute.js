const express = require("express");
const router = express.Router();
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const Child = require('../models/child')
const Request= require('../models/request');
const Parent = require('../models/parent')
const {schoolAuthMiddleware} = require('../jwt');

// School Registration Route
router.post('/register', async (req, res) => {
  const { schoolName, username, password } = req.body;

  try {
    // Check if school username already exists
    const existingSchool = await School.findOne({ username });
    if (existingSchool) {
      return res.status(400).json({ error: 'School username already exists' });
    }

    // Create new school
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
      .lean(); // Use lean() to get plain JavaScript objects

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
        reason: request.reason || null, // Ensure reason is included
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
router.get('/all-children', schoolAuthMiddleware, async (req, res) => {
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

module.exports = router;
