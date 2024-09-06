const express = require("express");
const router = express.Router();
const Geofencing = require("../models/geofence");
require("dotenv").config();

// GET route to retrieve geofencing data by deviceId
router.get("/", async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const geofencingData = await Geofencing.find({ deviceId });

    if (!geofencingData || geofencingData.length === 0) {
      return res
        .status(404)
        .json({ message: "No geofencing data found for this deviceId" });
    }

    // Restructure the response to have deviceId on top with nested geofencing data
    const response = {
      deviceId: deviceId,
      geofences: geofencingData.map((data) => ({
        _id: data._id,
        name: data.name,
        area: data.area,
        isCrossed: data.isCrossed,
      })),
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/isCrossed", async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const { isCrossed } = req.body;

    if (!deviceId) {
      return res
        .status(400)
        .json({ message: "deviceId query parameter is required" });
    }

    if (typeof isCrossed !== "boolean") {
      return res
        .status(400)
        .json({ message: "isCrossed must be a boolean value" });
    }

    const updatedGeofence = await Geofencing.findOneAndUpdate(
      { deviceId },
      { isCrossed },
      { new: true }
    );

    if (!updatedGeofence) {
      return res
        .status(404)
        .json({ message: "No geofencing data found for this deviceId" });
    }

    res.json({
      message: "isCrossed field updated successfully",
      data: updatedGeofence,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
