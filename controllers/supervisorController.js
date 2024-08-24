const Child = require("../models/child");
const Supervisor = require("../models/supervisor");
const Attendance = require('../models/attendence');
const Geofencing = require('../models/geofence')
const { encrypt } = require('../models/cryptoUtils');
const { generateToken} = require("../jwt");
// const sendNotification = require("../utils/sendNotification");
const { formatDateToDDMMYYYY,formatTime } = require('../utils/dateUtils');


// // Registration route
exports.registerSupervisor = async (req, res) => {
    try {
      const data = {
        supervisorName: req.body.supervisorName,
        phone_no: req.body.phone_no,
        email: req.body.email,
        address: req.body.address,
        password: req.body.password,
        busName:req.body.busName,
       deviceId:req.body.deviceId
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
  
      res.status(201).json({ response: { ...response.toObject(), password : data.encryptedPassword }, token });
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
}

// // login Route
exports.loginSupervisor = async (req, res) => {
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
}

// // get supervisor's data
exports.getSupervisordata = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        console.log(`Fetching data for supervisor with ID: ${supervisorId}`);
    
        // Fetch the supervisor data
        const supervisor = await Supervisor.findById(supervisorId);
        if (!supervisor) {
          return res.status(404).json({ error: "Supervisor not found" });
        }
    
        // Return the supervisor data
        res.status(200).json({ supervisor });
      } catch (error) {
        console.error("Error fetching supervisor data:", error);
        res.status(500).json({ error: "Internal server error" });
}}
// update supervisor's data
exports.updateSupervisor = async (req, res) => {
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
}
// get children
exports.getallChildren =  async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: "device ID is required" });
    }
    const children = await Child.find({ deviceId }).lean();
    console.log("Raw children data:", JSON.stringify(children, null, 2));
    const transformedChildren = children.map((child) => ({
      childId: child._id, 
      childName: child.childName,
      class: child.class,
      section: child.section,
      pickupPoint: child.pickupPoint
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
}
// //Route for marking pickup attendance
exports.markPickup = async (req, res) => {
  const { childId, isPresent } = req.body;

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  const currentTime = formatTime(today); // Automatically converts to IST

  try {
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ childId, date: formattedDate, pickup: null, drop: null });
    }

    attendanceRecord.pickup = isPresent;
    if (isPresent) {
      attendanceRecord.pickupTime = currentTime; // Set pickupTime only if the child is present
    } else {
      attendanceRecord.pickupTime = null; // Ensure pickupTime is null if the child is not present
    }
    
    await attendanceRecord.save();

    const message = isPresent
      ? `Child marked as present for pickup on ${formattedDate} at ${currentTime}`
      : `Child marked as absent for pickup`;

    res.status(200).json({ message });

  } catch (error) {
    console.error(`Error marking child as ${isPresent ? "present" : "absent"} for pickup:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// mark drop
exports.markDrop = async (req, res) => {
  const { childId, isPresent } = req.body;

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  const currentTime = formatTime(today);

  try {
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ childId, date: formattedDate, pickup: null, drop: null });
    }

    attendanceRecord.drop = isPresent;
    if (isPresent) {
      attendanceRecord.dropTime = currentTime; 
    } else {
      attendanceRecord.dropTime = null; 
    }
    
    await attendanceRecord.save();

    const message = isPresent 
      ? `Child marked as present for drop on ${formattedDate} at ${currentTime}`
      : `Child marked as absent for drop`;

    res.status(200).json({ message });

  } catch (error) {
    console.error(`Error marking child as ${isPresent ? "present" : "absent"} for drop:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create a new geofencing area
exports.addGeofence =  async (req, res) => {
  try {
    const { name, area, deviceId } = req.body;
    if (!name || !area || !deviceId) {
      return res.status(400).json({ error: "Name, area, and device ID are required" });
    }
    const newGeofencing = new Geofencing({
      name,
      area,
      deviceId
    });
    const savedGeofencing = await newGeofencing.save();
    res.status(201).json({ message: "Geofencing area created successfully", geofencing: savedGeofencing });
  } catch (error) {
    console.error("Error creating geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
// // Delete a geofencing area
exports.deleteGeofence =  async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the geofencing area by ID
    const deletedGeofencing = await Geofencing.findByIdAndDelete(id);

    if (!deletedGeofencing) {
      return res.status(404).json({ error: "Geofencing area not found" });
    }

    res.status(200).json({ message: "Geofencing area deleted successfully" });
  } catch (error) {
    console.error("Error deleting geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}




// // Update an existing geofencing area
// router.put("/geofencing/:id", jwtAuthMiddleware, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, description, area, calendarId, attributes } = req.body;

//     // Find and update the geofencing area by ID
//     const updatedGeofencing = await Geofencing.findByIdAndUpdate(
//       id,
//       { name, description, area, calendarId, attributes },
//       { new: true }
//     );

//     if (!updatedGeofencing) {
//       return res.status(404).json({ error: "Geofencing area not found" });
//     }

//     res.status(200).json({ message: "Geofencing area updated successfully", geofencing: updatedGeofencing });
//   } catch (error) {
//     console.error("Error updating geofencing area:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// }



// //update password
// exports.updatePassword = async (req, res) => {
//     try {
//       const { oldPassword, newPassword } = req.body;
//       const supervisorId = req.user.id;
  
//       // Find the supervisor by ID
//       const supervisor = await Supervisor.findById(supervisorId);
//       if (!supervisor) {
//         return res.status(404).json({ error: "Supervisor not found" });
//       }
  
//       // Check if the old password matches
//       const isMatch = await bcrypt.compare(oldPassword, supervisor.password);
//       if (!isMatch) {
//         return res.status(400).json({ error: "Old password is incorrect" });
//       }
  
//       // Hash the new password
//       const hashedPassword = await bcrypt.hash(newPassword, 10);
  
//       // Update the password
//       supervisor.password = hashedPassword;
//       await supervisor.save();
  
//       res.status(200).json({ message: "Password updated successfully" });
//     } catch (error) {
//       console.error("Error updating password:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
// }



// // delete supervisor's data
// exports.deleteSupervisor =  async (req, res) => {
//   try {
//     const supervisorId = req.user.id;
//     const supervisor = await Supervisor.findOneAndDelete({ _id: supervisorId });

//     if (!supervisor) {
//       return res.status(404).json({ error: "supervisor not found" });
//     }

//     res
//       .status(200)
//       .json({ message: "supervisor details deleted successfully", supervisor });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Error deleting supervisor details" });
//   }
// }