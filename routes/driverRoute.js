const express = require("express");
const router = express.Router();
// const bcrypt = require("bcrypt");
const Driver = require("../models/driver");
const { generateToken } = require("../jwt");

  // Registration route
  router.post("/register", async (req, res) => {
    try {
      const data = req.body;
      const { email } = data;
      console.log("Received registration data:", data);
      const existingDriver = await Driver.findOne({ email });
      if (existingDriver) {
        console.log("Email already exists");
        return res.status(400).json({ error: "Email already exists" });
      }
      const newDriver = new Driver(data);
      const response = await newDriver.save();
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
      const driver = await Driver.findOne({ email });
      if (!driver) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
      const isMatch = await driver.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
      const token = generateToken({ id: driver._id, email: driver.email });
      res.status(200).json({
        success: true,
        message: "Login successful",
        token: token,
      });
    } catch (err) {
      console.error("Error during login:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

module.exports = router;
