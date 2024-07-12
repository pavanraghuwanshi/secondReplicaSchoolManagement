const express = require("express");
const bcrypt = require("bcrypt");
const Student = require("../models/student");
const { generateToken } = require("../jwt");

const router = express.Router();

// Registration route
router.post('/register', async (req, res) => {
  try {
    const data = req.body;
    const { email } = data;    
    console.log('Received registration data:', data);

    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      console.log('Email already exists');
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newStudent = new Student(data);
    const response = await newStudent.save();
    console.log('Data saved:', response);

    const payload = {
      id: response.id,
      username: response.email,
    };

    console.log('JWT payload:', JSON.stringify(payload));
    const token = generateToken(payload);
    console.log('Generated token:', token);

    res.status(201).json({ response, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({ id: student._id, email: student.email });
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

module.exports = router;
