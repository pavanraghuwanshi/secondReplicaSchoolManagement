const express = require("express");
const bcrypt = require("bcrypt");
const Student = require("../models/student"); // Adjust the path as necessary
const { generateToken } = require("../jwt"); // Adjust the path as necessary

const router = express.Router();

// Registration route
  router.post('/register', async (req, res) => {
    try {
      const data = req.body;
      const { email } = data;
      const existingStudent = await Student.findOne({ email });
      if (existingStudent) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      const newStudent = new Student(data);
      const response = await newStudent.save();
      console.log('data saved');

      const payload = {
        id: response.id,
        username: response.email,
      };

      console.log(JSON.stringify(payload));
      const token = generateToken(payload);
      console.log('Token is:', token);
      res.status(201).json({ response, token });
    } catch (error) {
      console.log(error);
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
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
