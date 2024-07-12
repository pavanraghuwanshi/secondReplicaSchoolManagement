const express = require("express");
const bcrypt = require("bcrypt");
const Child = require("../models/child");
const { generateToken,jwtAuthMiddleware } = require("../jwt");

const router = express.Router();

// Registration route
router.post('/register', async (req, res) => {
  try {
    const data = req.body;
    const { email } = data;    
    console.log('Received registration data:', data);

    const existingchild = await Child.findOne({ email });
    if (existingchild) {
      console.log('Email already exists');
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newchild = new Child(data);
    const response = await newchild.save();
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
    const child = await Child.findOne({ email });
    if (!child) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await child.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({ id: child._id, email: child.email });
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

// Profile route
router.get('/getchilddata', jwtAuthMiddleware, async (req, res) => {
  try{
      const childData = req.user;
      const childId = childData.id;
      const child = await Child.findById(childId);
      res.status(200).json({child});
  }catch(err){
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
})


module.exports = router;