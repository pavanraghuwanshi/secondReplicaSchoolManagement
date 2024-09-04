const Child = require("../models/child");
const Supervisor = require("../models/supervisor");
const Attendance = require('../models/attendence');
const Geofencing = require('../models/geofence');
const Branch = require('../models/branch');
const { generateToken} = require("../jwt");
// const sendNotification = require("../utils/sendNotification");
const School = require("../models/school");
const { formatDateToDDMMYYYY,formatTime } = require('../utils/dateUtils');



// Fetch School List Route
// exports.getSchools =  async (req, res) => {
//   try {
//     const schools = await School.find({}, 'schoolName');
//     res.status(200).json({ schools });
//   } catch (error) {
//     console.error('Error fetching school list:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// }

exports.getSchools =  async (req, res) => {
  try {
    // Fetch schools and populate branches
    const schools = await School.find({}, 'schoolName branches')
      .populate({
        path: 'branches',
        select: 'branchName -_id' // Ensure 'branchName' is selected and '_id' is excluded
      })
      .lean(); // Use lean to get plain JavaScript objects

    // Map the schools to only include the required fields
    const formattedSchools = schools.map(school => ({
      schoolName: school.schoolName,
      branches: school.branches.map(branch => branch.branchName) // Ensure branchName is included
    }));

    res.status(200).json({ schools: formattedSchools });
  } catch (error) {
    console.error('Error fetching school list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// // Registration route
// exports.registerSupervisor = async (req, res) => {
//   try {
//     const {
//       supervisorName,
//       email,
//       password, 
//       phone_no,
//       address,
//       busName,
//       deviceId,
//       schoolName
//     } = req.body;

//     console.log(`Registering supervisor with schoolName: "${schoolName.trim()}"`);

//     // Check if supervisor email already exists
//     const existingSupervisor = await Supervisor.findOne({ email });
//     if (existingSupervisor) {
//       console.log('Email already exists');
//       return res.status(400).json({ error: 'Email already exists' });
//     }

//     // Find the school by name
//     const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') });

//     if (!school) {
//       console.log('School not found:', schoolName.trim());
//       return res.status(400).json({ error: 'School not found' });
//     }

//     // Create new supervisor with a pending status
//     const newSupervisor = new Supervisor({
//       supervisorName,
//       email,
//       password, 
//       phone_no,
//       address,
//       busName,
//       deviceId,
//       schoolId: school._id, // Link to the school's ID
//       statusOfRegister: 'pending'
//     });
//     const response = await newSupervisor.save();

//     // Generate JWT token
//     const payload = { id: response._id, email: response.email, schoolId: school._id };
//     const token = generateToken(payload);
//     console.log('Generated token:', token);

//     res.status(201).json({ supervisor: response, token });
//   } catch (error) {
//     console.error('Error during supervisor registration:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };


exports.registerSupervisor = async (req, res) => {
  try {
    const {
      supervisorName,
      email,
      password, 
      phone_no,
      address,
      busName,
      deviceId,
      schoolName,
      branchName // Expect branch in the request
    } = req.body;

    console.log(`Registering supervisor with schoolName: "${schoolName.trim()}"`);

    // Check if supervisor email already exists
    const existingSupervisor = await Supervisor.findOne({ email });
    if (existingSupervisor) {
      console.log('Email already exists');
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');

    if (!school) {
      console.log('School not found:', schoolName.trim());
      return res.status(400).json({ error: 'School not found' });
    }

    let branchToAssign;
    if (school.branches.length === 0) {
      // No branches, use the default main branch
      branchToAssign = school.defaultBranchId;
    } else {
      // Find the branch by name or use the default branch
      const selectedBranch = await Branch.findOne({ branchName: branchName.trim(), schoolId: school._id });
      branchToAssign = selectedBranch ? selectedBranch._id : school.defaultBranchId;
    }

    // Create new supervisor with a pending status
    const newSupervisor = new Supervisor({
      supervisorName,
      email,
      password, 
      phone_no,
      address,
      busName,
      deviceId,
      schoolId: school._id, // Link to the school's ID
      branchId: branchToAssign, // Link to the branch's ID
      statusOfRegister: 'pending'
    });
    const response = await newSupervisor.save();

    // Generate JWT token
    const payload = { id: response._id, email: response.email, schoolId: school._id, branchId: branchToAssign };
    const token = generateToken(payload);
    console.log('Generated token:', token);

    res.status(201).json({ supervisor: response, token });
  } catch (error) {
    console.error('Error during supervisor registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// // login Route
exports.loginSupervisor = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find supervisor by email
    const supervisor = await Supervisor.findOne({ email });

    // Check if supervisor exists
    if (!supervisor) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare provided password with stored hashed password
    const isMatch = await supervisor.comparePassword(password);

    // Check if password matches
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT token with supervisor ID, email, and schoolId
    const token = generateToken({
      id: supervisor._id,
      email: supervisor.email,
      schoolId: supervisor.schoolId, // Add schoolId to the token payload
    });

    // Send success response with token
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// // get supervisor's data
exports.getSupervisordata = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    console.log(`Fetching data for supervisor with ID: ${supervisorId} and School ID: ${schoolId}`);
    
    // Fetch the supervisor data
    const supervisor = await Supervisor.findOne({ _id: supervisorId, schoolId: schoolId });
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found or does not belong to this school" });
    }
    
    // Return the supervisor data
    res.status(200).json({ supervisor });
  } catch (error) {
    console.error("Error fetching supervisor data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// update supervisor's data
exports.updateSupervisor = async (req, res) => {
  try {
    const { supervisorName, address, phone, email } = req.body;
    const supervisorId = req.user.id;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    // Update supervisor details, ensuring they belong to the correct school
    const supervisor = await Supervisor.findOneAndUpdate(
      { _id: supervisorId, schoolId: schoolId },
      { supervisorName, address, phone, email },
      { new: true }
    );

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found or does not belong to this school" });
    }

    res.status(200).json({ message: "Supervisor details updated successfully", supervisor });
  } catch (error) {
    console.error("Error updating supervisor details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};




// get children
exports.getallChildren = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    if (!deviceId) {
      return res.status(400).json({ error: "device ID is required" });
    }

    // Find children by deviceId and schoolId
    const children = await Child.find({ deviceId, schoolId }).lean();
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
};


// //Route for marking pickup attendance

exports.markPickup = async (req, res) => {
  const { childId, isPresent } = req.body;
  const { schoolId } = req; // Get the schoolId from the authenticated request

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  const currentTime = formatTime(today); // Automatically converts to IST

  try {
    // Check if the child belongs to the current school
    const child = await Child.findOne({ _id: childId, schoolId });

    if (!child) {
      return res.status(404).json({ error: "Child not found or does not belong to the current school" });
    }

    // Find or create the attendance record for the child on the current date
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        childId,
        date: formattedDate,
        pickup: null,
        drop: null,
        schoolId, // Include schoolId in the attendance record
      });
    }

    // Update the pickup status and time
    attendanceRecord.pickup = isPresent;
    attendanceRecord.pickupTime = isPresent ? currentTime : null; // Set pickupTime if present, otherwise null

    // Save the attendance record
    await attendanceRecord.save();

    const message = isPresent
      ? `Child marked as present for pickup on ${formattedDate} at ${currentTime}`
      : `Child marked as absent for pickup`;

    res.status(200).json({ message });

  } catch (error) {
    console.error(`Error marking child as ${isPresent ? "present" : "absent"} for pickup:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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
    // Extract schoolId from the authenticated supervisor (using the middleware)
    const schoolId = req.schoolId;

    // Fetch the child record and ensure it belongs to the correct school
    const child = await Child.findOne({ _id: childId, schoolId });
    if (!child) {
      return res.status(404).json({ error: "Child not found or does not belong to this school" });
    }

    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ childId, date: formattedDate, pickup: null, drop: null, schoolId });
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
};


// Create a new geofencing area
exports.addGeofence = async (req, res) => {
  try {
    const { name, area, deviceId } = req.body;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    if (!name || !area || !deviceId) {
      return res.status(400).json({ error: "Name, area, and device ID are required" });
    }

    const newGeofencing = new Geofencing({
      name,
      area,
      deviceId,
      schoolId // Add schoolId to the geofencing document
    });

    const savedGeofencing = await newGeofencing.save();
    res.status(201).json({ message: "Geofencing area created successfully", geofencing: savedGeofencing });
  } catch (error) {
    console.error("Error creating geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


// // Delete a geofencing area
exports.deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    // Find and delete the geofencing area by ID only if it belongs to the school
    const deletedGeofencing = await Geofencing.findOneAndDelete({ _id: id, schoolId });

    if (!deletedGeofencing) {
      return res.status(404).json({ error: "Geofencing area not found or does not belong to the authenticated school" });
    }

    res.status(200).json({ message: "Geofencing area deleted successfully" });
  } catch (error) {
    console.error("Error deleting geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};




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