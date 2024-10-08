const express = require("express");
const router = express.Router();
const Geofencing = require("../models/geofence");
require("dotenv").config();
const { formatDateToDDMMYYYY } = require("../utils/dateUtils");


// GET route to retrieve geofencing data by deviceId
// router.get("/", async (req, res) => {
//   try {
//     const deviceId = req.query.deviceId;
//     const geofencingData = await Geofencing.find({ deviceId });

//     if (!geofencingData || geofencingData.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No geofencing data found for this deviceId" });
//     }

//     // Restructure the response to have deviceId on top with nested geofencing data
//     const response = {
//       deviceId: deviceId,
//       geofences: geofencingData.map((data) => ({
//         _id: data._id,
//         name: data.name,
//         area: data.area,
//         isCrossed: data.isCrossed,
//         busStopTime:data.busStopTime,
//         arrivalTime:data.arrivalTime,
//         departureTime:data.departureTime
//       })),
//     };

//     res.json(response);
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// });
router.put("/isCrossed/", async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const { isCrossed, arrivalTime, departureTime } = req.body;

    // Validate deviceId query parameter
    if (!deviceId) {
      return res
        .status(400)
        .json({ message: "deviceId query parameter is required" });
    }

    // Validate isCrossed field
    if (typeof isCrossed !== "boolean") {
      return res
        .status(400)
        .json({ message: "isCrossed must be a boolean value" });
    }

    // Build update object dynamically based on the received fields
    const updateData = { isCrossed };
    if (arrivalTime) updateData.arrivalTime = arrivalTime;
    if (departureTime) updateData.departureTime = departureTime;

    // Find the document by deviceId and update it
    const updatedGeofence = await Geofencing.findOneAndUpdate(
      { deviceId },
      updateData,
      { new: true }
    );

    // Check if the document exists
    if (!updatedGeofence) {
      return res
        .status(404)
        .json({ message: "No geofencing data found for this deviceId" });
    }

    // Respond with success and the updated document
    res.json({
      message: "Geofencing data updated successfully",
      data: updatedGeofence,
    });
  } catch (error) {
    // Handle server errors
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const currentDate = formatDateToDDMMYYYY(new Date());

    // Fetch geofencing data based on deviceId
    const geofencingData = await Geofencing.find({ deviceId });

    if (!geofencingData || geofencingData.length === 0) {
      return res
        .status(404)
        .json({ message: "No geofencing data found for this deviceId" });
    }

    const updatedGeofencingData = geofencingData.map((data) => {
      // If lastUpdated date is not today, reset isCrossed, arrivalTime, and departureTime
      if (data.lastUpdated !== currentDate) {
        data.isCrossed = false;
        data.arrivalTime = "";
        data.departureTime = "";
        data.lastUpdated = currentDate; // Update lastUpdated to today

        // Save changes to the database
        data.save();
      }

      // Return the updated or existing fields
      return {
        _id: data._id,
        name: data.name,
        area: data.area,
        isCrossed: data.isCrossed,
        busStopTime: data.busStopTime,
        arrivalTime: data.arrivalTime,
        departureTime: data.departureTime,
      };
    });

    // Send the response with updated data
    res.json({
      deviceId: deviceId,
      geofences: updatedGeofencingData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
