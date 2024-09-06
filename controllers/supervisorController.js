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
exports.getSchools =  async (req, res) => {
  try {
    const schools = await School.find().populate('branches');

    const response = schools.map(school => {
      return {
        schoolName: school.schoolName,
        mainBranch: school.mainBranch, // Main branch
        branches: school.branches.map(branch => branch.branchName) // Additional branches
      };
    });

    res.status(200).json({ schools: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
exports.registerSupervisor = async (req, res) => {
  try {
    const {
      supervisorName,
      email,
<<<<<<< HEAD
      password,
=======
      password, 
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
      phone_no,
      address,
      busName,
      deviceId,
      schoolName,
      branchName // Expect branch in the request
    } = req.body;

<<<<<<< HEAD
    // Validate that required fields are present
    if (!schoolName || !branchName) {
      return res.status(400).json({ error: 'School name and branch name are required' });
    }
=======
    console.log(`Registering supervisor with schoolName: "${schoolName.trim()}"`);
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1

    // Check if supervisor email already exists
    const existingSupervisor = await Supervisor.findOne({ email });
    if (existingSupervisor) {
<<<<<<< HEAD
      return res.status(400).json({ error: 'Supervisor email already exists' });
=======
      console.log('Email already exists');
      return res.status(400).json({ error: 'Email already exists' });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    }

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
<<<<<<< HEAD
    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    // Find the branch by name within the found school
    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found in the specified school' });
=======

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
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    }

    // Create new supervisor with a pending status
    const newSupervisor = new Supervisor({
      supervisorName,
      email,
<<<<<<< HEAD
      password, // Password hashing should be handled in the schema or middleware
=======
      password, 
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
      phone_no,
      address,
      busName,
      deviceId,
      schoolId: school._id, // Link to the school's ID
<<<<<<< HEAD
      branchId: branch._id,  // Link to the branch's ID
=======
      branchId: branchToAssign, // Link to the branch's ID
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
      statusOfRegister: 'pending'
    });
    const response = await newSupervisor.save();

<<<<<<< HEAD
    // Generate JWT token with supervisor ID, email, schoolId, and branchId
    const payload = { id: response._id, email: response.email, schoolId: school._id, branchId: branch._id };
    const token = generateToken(payload);

    res.status(201).json({ 
      supervisor: { ...response.toObject(), password: undefined }, // Do not return the password in the response
      token 
    });
=======
    // Generate JWT token
    const payload = { id: response._id, email: response.email, schoolId: school._id, branchId: branchToAssign };
    const token = generateToken(payload);
    console.log('Generated token:', token);

    res.status(201).json({ supervisor: response, token });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  } catch (error) {
    console.error('Error during supervisor registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
<<<<<<< HEAD
=======


// mainBranchCode of regusteration
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
//       schoolName,
//       branchName // Expect branch in the request
//     } = req.body;

//     console.log(`Registering supervisor with schoolName: "${schoolName.trim()}"`);

//     // Check if supervisor email already exists
//     const existingSupervisor = await Supervisor.findOne({ email });
//     if (existingSupervisor) {
//       console.log('Email already exists');
//       return res.status(400).json({ error: 'Email already exists' });
//     }

//     // Find the school by name
//     const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');

//     if (!school) {
//       console.log('School not found:', schoolName.trim());
//       return res.status(400).json({ error: 'School not found' });
//     }

//     let branchToAssign;

//     if (!branchName || branchName.trim() === school.mainBranch) {
//       // If no branchName is provided or if the selected branch is the main branch
//       branchToAssign = school._id; // Use schoolId as branchId for main branch
//     } else {
//       // Find the branch by name or use the default branch
//       const selectedBranch = await Branch.findOne({ branchName: branchName.trim(), schoolId: school._id });
//       branchToAssign = selectedBranch ? selectedBranch._id : school.defaultBranchId;
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
//       branchId: branchToAssign, // Link to the branch's ID
//       statusOfRegister: 'pending'
//     });

//     const response = await newSupervisor.save();

//     // Generate JWT token
//     const payload = { id: response._id, email: response.email, schoolId: school._id, branchId: branchToAssign };
//     const token = generateToken(payload);
//     console.log('Generated token:', token);

//     res.status(201).json({ supervisor: response, token });
//   } catch (error) {
//     console.error('Error during supervisor registration:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };


// // login Route
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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

<<<<<<< HEAD
    // Generate JWT token with supervisor ID, email, schoolId, and branchId
    const token = generateToken({
      id: supervisor._id,
      email: supervisor.email,
      schoolId: supervisor.schoolId,   // Add schoolId to the token payload
      branchId: supervisor.branchId    // Add branchId to the token payload
=======
    // Generate JWT token with supervisor ID, email, and schoolId
    const token = generateToken({
      id: supervisor._id,
      email: supervisor.email,
      schoolId: supervisor.schoolId, // Add schoolId to the token payload
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
=======

>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
// // get supervisor's data
exports.getSupervisordata = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware
<<<<<<< HEAD
    const branchId = req.query.branchId; // Get branchId from query parameters if provided

    console.log(`Fetching data for supervisor with ID: ${supervisorId}, School ID: ${schoolId}, and Branch ID: ${branchId}`);

    // Build query object based on provided parameters
    const query = { _id: supervisorId, schoolId: schoolId };
    if (branchId) {
      query.branchId = branchId;
    }

    // Fetch the supervisor data based on the query
    const supervisor = await Supervisor.findOne(query)
      .populate('schoolId', 'schoolName') // Populate related fields
      .populate('branchId', 'branchName'); // Populate related fields

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found or does not belong to this school/branch" });
    }

    // Create a simplified response object
    const response = {
      supervisorName: supervisor.supervisorName,
      address: supervisor.address,
      email: supervisor.email,
      phone_no: supervisor.phone_no,
      deviceId: supervisor.deviceId,
      busName: supervisor.busName,
      schoolName: supervisor.schoolId.schoolName, // Get schoolName from populated field
      branchName: supervisor.branchId.branchName, // Get branchName from populated field
      registrationDate: supervisor.registrationDate
    };

    // Return the simplified supervisor data
    res.status(200).json({ supervisor: response });
=======

    console.log(`Fetching data for supervisor with ID: ${supervisorId} and School ID: ${schoolId}`);
    
    // Fetch the supervisor data
    const supervisor = await Supervisor.findOne({ _id: supervisorId, schoolId: schoolId });
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found or does not belong to this school" });
    }
    
    // Return the supervisor data
    res.status(200).json({ supervisor });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  } catch (error) {
    console.error("Error fetching supervisor data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
<<<<<<< HEAD
=======

>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
=======




>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
// //Route for marking pickup attendance
exports.markPickup = async (req, res) => {
  const { childId, isPresent } = req.body;
  const { schoolId, branchId } = req; // Get the schoolId and branchId from the authenticated request
=======


// //Route for marking pickup attendance

exports.markPickup = async (req, res) => {
  const { childId, isPresent } = req.body;
  const { schoolId } = req; // Get the schoolId from the authenticated request
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  const currentTime = formatTime(today); // Automatically converts to IST

  try {
<<<<<<< HEAD
    // Check if the child belongs to the current school and branch
    const child = await Child.findOne({ _id: childId, schoolId, branchId });

    if (!child) {
      return res.status(404).json({ error: "Child not found or does not belong to the current school or branch" });
=======
    // Check if the child belongs to the current school
    const child = await Child.findOne({ _id: childId, schoolId });

    if (!child) {
      return res.status(404).json({ error: "Child not found or does not belong to the current school" });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    }

    // Find or create the attendance record for the child on the current date
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        childId,
        date: formattedDate,
        pickup: null,
        drop: null,
<<<<<<< HEAD
        schoolId,
        branchId // Include branchId in the attendance record
=======
        schoolId, // Include schoolId in the attendance record
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
// mark drop
exports.markDrop = async (req, res) => {
  const { childId, isPresent } = req.body;
  const { schoolId, branchId } = req; // Extract schoolId and branchId from the request (assuming middleware sets it)
=======

// mark drop
exports.markDrop = async (req, res) => {
  const { childId, isPresent } = req.body;
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  const currentTime = formatTime(today);

  try {
<<<<<<< HEAD
    // Ensure the child belongs to the correct school and branch
    const child = await Child.findOne({ _id: childId, schoolId, branchId });
    if (!child) {
      return res.status(404).json({ error: "Child not found or does not belong to this school/branch" });
    }

    // Find or create the attendance record for the child on the current date
    let attendanceRecord = await Attendance.findOne({ childId, date: formattedDate });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        childId,
        date: formattedDate,
        pickup: null,
        drop: null,
        schoolId,
        branchId // Include branchId in the attendance record
      });
    }

    // Update the drop status and time
    attendanceRecord.drop = isPresent;
    attendanceRecord.dropTime = isPresent ? currentTime : null;

    // Save the attendance record
=======
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

>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
=======


>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
// Create a new geofencing area
exports.addGeofence = async (req, res) => {
  try {
    const { name, area, deviceId } = req.body;
<<<<<<< HEAD
    if (!name || !area || !deviceId) {
      return res.status(400).json({ error: "Name, area, and device ID are required" });
    }
    const newGeofencing = new Geofencing({
      name,
      area,
      deviceId
    });
=======
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

>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    const savedGeofencing = await newGeofencing.save();
    res.status(201).json({ message: "Geofencing area created successfully", geofencing: savedGeofencing });
  } catch (error) {
    console.error("Error creating geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
<<<<<<< HEAD
=======


>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
// // Delete a geofencing area
exports.deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params;
<<<<<<< HEAD

    // Find and delete the geofencing area by ID
    const deletedGeofencing = await Geofencing.findByIdAndDelete(id);

    if (!deletedGeofencing) {
      return res.status(404).json({ error: "Geofencing area not found" });
=======
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    // Find and delete the geofencing area by ID only if it belongs to the school
    const deletedGeofencing = await Geofencing.findOneAndDelete({ _id: id, schoolId });

    if (!deletedGeofencing) {
      return res.status(404).json({ error: "Geofencing area not found or does not belong to the authenticated school" });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    }

    res.status(200).json({ message: "Geofencing area deleted successfully" });
  } catch (error) {
    console.error("Error deleting geofencing area:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
<<<<<<< HEAD
=======




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
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
