const express = require("express");
const router = express.Router();
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const Child = require('../models/child');
const Request= require('../models/request');
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

// Get all children data
router.get('/all-children', schoolAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({});
    res.status(200).json({ children });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/getrequestdata', async (req, res) => {
  try {
    // Find all requests
    const requests = await Request.find({})
      .populate({
        path: 'childId',
        select: 'childName parentName',  // Adjust as needed
        populate: {
          path: 'parentId',
          select: 'parentName'
        }
      })
      .populate({
        path: 'parentId',
        select: 'parentName'  // Adjust as needed
      });

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching request data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
