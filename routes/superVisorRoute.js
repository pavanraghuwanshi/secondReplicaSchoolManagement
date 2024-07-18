// routes/superVisor.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const superVisor = require("../models/superVisor");
const { generateToken} = require("../jwt");

// Registration route
router.post("/register", async (req, res) => {
  try {
    const data = req.body;
    const { email } = data;

    console.log("Received registration data:", data);

    const existingsuperVisor = await superVisor.findOne({ email });
    if (existingsuperVisor) {
      console.log("Email already exists");
      return res.status(400).json({ error: "Email already exists" });
    }

    const newsuperVisor = new superVisor(data);
    const response = await newsuperVisor.save();
    console.log("Data saved:", response);

    const payload = {
      id: response.id,
      email: response.email,
    };

    console.log("JWT payload:", JSON.stringify(payload));
    const token = generateToken(payload);
    console.log("Generated token:", token);

    res.status(201).json({ response, token });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const superVisor = await superVisor.findOne({ email });
    if (!superVisor) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await superVisor.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({ id: superVisor._id, email: superVisor.email });
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
