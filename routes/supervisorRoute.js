const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Child = require("../models/child");
const Supervisor = require("../models/supervisor");
const Parent = require('../models/Parent');
const Attendance = require('../models/attendence')
const { encrypt } = require('../models/cryptoUtils');
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const sendNotification = require("../utils/sendNotification");
const { formatDateToDDMMYYYY } = require('../utils/dateUtils');

// Registration route
router.post("/register", async (req, res) => {
  try {
    const data = {
      supervisorName: req.body.supervisorName,
      phone_no: req.body.phone_no,
      email: req.body.email,
      address: req.body.address,
      password: req.body.password,
    };
    const { email } = data;
    console.log("Received registration data:", data);

    const existingSupervisor = await Supervisor.findOne({ email });
    if (existingSupervisor) {
      console.log("Email already exists");
      return res.status(400).json({ error: "Email already exists" });
    }

    // Encrypt the password before saving
    data.encryptedPassword = encrypt(data.password);
    console.log("Encrypted password:", data.encryptedPassword);

    const newSupervisor = new Supervisor(data);
    const response = await newSupervisor.save();
    console.log("Data saved:", response);

    const payload = {
      id: response.id,
      email: response.email,
    };
    console.log("JWT payload:", JSON.stringify(payload));
    
    const token = generateToken(payload);
    console.log("Generated token:", token);

    res.status(201).json({ response: { ...response.toObject(), encryptedPassword: data.encryptedPassword }, token });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const supervisor = await Supervisor.findOne({ email });
    if (!supervisor) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await supervisor.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({
      id: supervisor._id,
      email: supervisor.email,
    });
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
// Get supervisor's data
router.get("/getsupervisorData", jwtAuthMiddleware, async (req, res) => {
  try {
    const supervisorId = req.user.id;
    console.log(`Fetching data for supervisor with ID: ${supervisorId}`);
    const supervisor = await Supervisor.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({ error: "supervisor not found" });
    }
    res.status(200).json({ supervisor });
  } catch (error) {
    console.error("Error fetching supervisor data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// update supervisor's data
router.put("/update", jwtAuthMiddleware, async (req, res) => {
  try {
    const { supervisorName, address, phone, email } = req.body;
    const supervisorId = req.user.id;

    // Update supervisor details excluding the password
    const supervisor = await Supervisor.findOneAndUpdate(
      { _id: supervisorId },
      { supervisorName, address, phone, email },
      { new: true }
    );

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    res
      .status(200)
      .json({ message: "Supervisor details updated successfully", supervisor });
  } catch (error) {
    console.error("Error updating supervisor details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/update-password", jwtAuthMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const supervisorId = req.user.id;

    // Find the supervisor by ID
    const supervisor = await Supervisor.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    // Check if the old password matches
    const isMatch = await bcrypt.compare(oldPassword, supervisor.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    supervisor.password = hashedPassword;
    await supervisor.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// delete supervisor's data
router.delete("/delete", jwtAuthMiddleware, async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisor = await Supervisor.findOneAndDelete({ _id: supervisorId });

    if (!supervisor) {
      return res.status(404).json({ error: "supervisor not found" });
    }

    res
      .status(200)
      .json({ message: "supervisor details deleted successfully", supervisor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deleting supervisor details" });
  }
});

// get children
router.get("/read/all-children", jwtAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({}).lean();
    console.log("Raw children data:", JSON.stringify(children, null, 2));

    const transformedChildren = children.map((child) => ({
      childName: child.childName,
      class: child.class,
      section: child.section,
    }));

    console.log(
      "Transformed children data:",
      JSON.stringify(transformedChildren, null, 2)
    );
    res.status(200).json({ children: transformedChildren });
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route for marking pickup attendance
router.put("/mark-pickup", jwtAuthMiddleware, async (req, res) => {
  const { childId, isPresent } = req.body;

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);

  try {
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ childId, date: formattedDate, pickup: null, drop: null });
    }

    attendanceRecord.pickup = isPresent;
    await attendanceRecord.save();

    const child = await Child.findById(childId).populate('parentId');
    const parent = child.parentId;

    if (parent && parent.fcmToken) {
      const actionMessage = isPresent ? "picked up from the bus stop" : "not present at the bus stop for pickup";
      const title = "Child Pickup Notification";
      const body = `Your child ${child.childName} was ${actionMessage} on ${formattedDate}.`;

      await sendNotification(parent.fcmToken, title, body);
      console.log(`Notification sent to parent: ${body}`);
    }

    res.status(200).json({ message: `Child marked as ${isPresent ? "present" : "absent"} for pickup on ${formattedDate}` });
  } catch (error) {
    console.error(`Error marking child as ${isPresent ? "present" : "absent"} for pickup:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route for marking drop attendance
router.put("/mark-drop", jwtAuthMiddleware, async (req, res) => {
  const { childId, isPresent } = req.body;

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);

  try {
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ childId, date: formattedDate, pickup: null, drop: null });
    }

    attendanceRecord.drop = isPresent;
    await attendanceRecord.save();

    const child = await Child.findById(childId).populate('parentId');
    const parent = child.parentId;

    if (parent && parent.fcmToken) {
      const actionMessage = isPresent ? "dropped off at the bus stop" : "not present in the bus for drop";
      const title = "Child Drop Notification";
      const body = `Your child ${child.childName} was ${actionMessage} on ${formattedDate}.`;

      await sendNotification(parent.fcmToken, title, body);
      console.log(`Notification sent to parent: ${body}`);
    }

    res.status(200).json({ message: `Child marked as ${isPresent ? "present" : "absent"} for drop on ${formattedDate}` });
  } catch (error) {
    console.error(`Error marking child as ${isPresent ? "present" : "absent"} for drop:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
