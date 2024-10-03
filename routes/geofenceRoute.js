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
        busStopTime:data.busStopTime,
        arrivalTime:data.arrivalTime,
        departureTime:data.departureTime
      })),
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// router.put("/isCrossed/", async (req, res) => {
//   try {
//     const deviceId = req.query.deviceId;
//     const { isCrossed , arrivalTime ,departureTime} = req.body;

//     if (!deviceId) {
//       return res
//         .status(400)
//         .json({ message: "deviceId query parameter is required" });
//     }

//     if (typeof isCrossed !== "boolean") {
//       return res
//         .status(400)
//         .json({ message: "isCrossed must be a boolean value" });
//     }

//     const updatedGeofence = await Geofencing.findOneAndUpdate(
//       { deviceId },
//       { isCrossed },
//       { new: true }
//     );

//     if (!updatedGeofence) {
//       return res
//         .status(404)
//         .json({ message: "No geofencing data found for this deviceId" });
//     }

//     res.json({
//       message: "isCrossed field updated successfully",
//       data: updatedGeofence,
//     });
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



module.exports = router;
