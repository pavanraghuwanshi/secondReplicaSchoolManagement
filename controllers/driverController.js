const DriverCollection = require("../models/driver");
const { generateToken } = require("../jwt");
const School = require("../models/school");
const Branch = require('../models/branch');


<<<<<<< HEAD
exports.registerDriver = async (req, res) => {
  try {
    const {
      driverName,
      phone_no,
      email,
      address,
      password,
      busName,
      deviceId,
      schoolName,
      branchName
    } = req.body;

    // Validate that required fields are present
    if (!schoolName || !branchName) {
      return res.status(400).json({ error: 'School name and branch name are required' });
    }

    // Check if driver email already exists
    const existingDriver = await DriverCollection.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ error: 'Driver email already exists' });
    }

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    // Find the branch by name within the found school
    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found in the specified school' });
    }

    // Create new driver linked to the school and branch
    const newDriver = new DriverCollection({
      driverName,
      phone_no,
      email,
      address,
      password, // Ensure password is hashed in schema or before saving
      busName,
      deviceId,
      schoolId: school._id, // Link to the school's ID
      branchId: branch._id  // Link to the branch's ID
    });
    const response = await newDriver.save();

    // Generate JWT token with driver ID and email
    const payload = { id: response._id, email: response.email, schoolId: school._id, branchId: branch._id };
    const token = generateToken(payload);

    res.status(201).json({ driver: { ...response.toObject(), password: undefined }, token });
  } catch (error) {
    console.error('Error during driver registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
//Fetch School List Route
=======
// exports.registerDriver = async (req, res) => {
//   try {
//     const data = {
//       driverName: req.body.driverName,
//       phone_no: req.body.phone_no,
//       email: req.body.email,
//       address: req.body.address,
//       password: req.body.password,
//       busName: req.body.busName,
//       deviceId: req.body.deviceId
//     };
//     const { email } = data;
//     console.log("Received registration data:", data);

//     const existingDriver = await DriverCollection.findOne({ email });
//     if (existingDriver) {
//       console.log("Email already exists");
//       return res.status(400).json({ error: "Email already exists" });
//     }

//     const newDriver = new DriverCollection(data);
//     const response = await newDriver.save();
//     console.log("Data saved:", response);

//     const payload = { id: response.id, email: response.email };
//     const token = generateToken(payload);

//     res.status(201).json({ response: { ...response.toObject(), password: undefined }, token }); 
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };


// Fetch School List Route

// exports.getSchools =  async (req, res) => {
//   try {
//     // Fetch schools and populate branches
//     const schools = await School.find({}, 'schoolName branches')
//       .populate({
//         path: 'branches',
//         select: 'branchName -_id' // Ensure 'branchName' is selected and '_id' is excluded
//       })
//       .lean(); // Use lean to get plain JavaScript objects

//     // Map the schools to only include the required fields
//     const formattedSchools = schools.map(school => ({
//       schoolName: school.schoolName,
//       branches: school.branches.map(branch => branch.branchName) // Ensure branchName is included
//     }));

//     res.status(200).json({ schools: formattedSchools });
//   } catch (error) {
//     console.error('Error fetching school list:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// }


>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
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
<<<<<<< HEAD
exports.loginDriver = async (req, res) => {
  const { email, password } = req.body;
  
=======

exports.registerDriver = async (req, res) => {
  try {
    const {
      driverName,
      email,
      password,
      schoolName,
      branchName, // Expect branch in the request, but handle the default case
      licenseNumber,
      deviceId,
      address,
      phone_no,
      fcmToken,
      busName
    } = req.body;

    console.log(`Registering driver with schoolName: "${schoolName.trim()}"`);

    // Check if driver email already exists
    const existingDriver = await DriverCollection.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ error: 'Driver email already exists' });
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

    // Create new driver with a pending status
    const newDriver = new DriverCollection({
      driverName,
      email,
      password, // No need to hash here, it will be done in the schema
      phone_no,
      licenseNumber,
      deviceId,
      fcmToken,
      address,
      busName,
      schoolId: school._id, // Link to the school's ID
      branchId: branchToAssign, // Link to the branch's ID
      statusOfRegister: 'pending'
    });
    await newDriver.save();

    // Generate JWT token
    const payload = { id: newDriver._id, email: newDriver.email, schoolId: school._id, branchId: branchToAssign };
    const token = generateToken(payload);

    res.status(201).json({ driver: newDriver, token });
  } catch (error) {
    console.error('Error during driver registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// mainbranch wise registration
// exports.registerDriver = async (req, res) => {
//   try {
//     const {
//       driverName,
//       email,
//       password,
//       schoolName,
//       branchName, // Expect branch in the request, but handle the default case
//       licenseNumber,
//       deviceId,
//       address,
//       phone_no,
//       fcmToken,
//       busName
//     } = req.body;

//     console.log(`Registering driver with schoolName: "${schoolName.trim()}"`);

//     // Check if driver email already exists
//     const existingDriver = await DriverCollection.findOne({ email });
//     if (existingDriver) {
//       return res.status(400).json({ error: 'Driver email already exists' });
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
//       branchToAssign = school._id; // Use schoolId as branchId for the main branch
//     } else {
//       // Find the branch by name or use the default branch
//       const selectedBranch = await Branch.findOne({ branchName: branchName.trim(), schoolId: school._id });
//       branchToAssign = selectedBranch ? selectedBranch._id : school.defaultBranchId;
//     }

//     // Create new driver with a pending status
//     const newDriver = new DriverCollection({
//       driverName,
//       email,
//       password, // No need to hash here, it will be done in the schema
//       phone_no,
//       licenseNumber,
//       deviceId,
//       fcmToken,
//       address,
//       busName,
//       schoolId: school._id, // Link to the school's ID
//       branchId: branchToAssign, // Link to the branch's ID
//       statusOfRegister: 'pending'
//     });

//     await newDriver.save();

//     // Generate JWT token
//     const payload = { id: newDriver._id, email: newDriver.email, schoolId: school._id, branchId: branchToAssign };
//     const token = generateToken(payload);

//     res.status(201).json({ driver: newDriver, token });
//   } catch (error) {
//     console.error('Error during driver registration:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

exports.loginDriver = async (req, res) => {
  const { email, password } = req.body;
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  try {
    // Find the driver by email
    const driver = await DriverCollection.findOne({ email });
    if (!driver) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Check if the password matches
<<<<<<< HEAD
    const isMatch = await driver.comparePassword(password); // Assuming you have a method to compare passwords
=======
    const isMatch = await driver.comparePassword(password);
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

<<<<<<< HEAD
    // Generate a JWT token with driverId, email, and schoolId
    const token = generateToken({ 
      id: driver._id, 
      email: driver.email, 
      schoolId: driver.schoolId,  // Include the driver's school ID in the token payload
      branchId: driver.branchId   // Include the branch ID in the token if necessary
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token
    });
=======
    // Generate token including schoolId if needed
    const token = generateToken({ 
      id: driver._id, 
      email: driver.email, 
      schoolId: driver.schoolId // Include schoolId in the token payload
    });

    res.status(200).json({ success: true, message: "Login successful", token });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
};

<<<<<<< HEAD
exports.getDriverData = async (req, res) => {
  try {
    const driverId = req.user.id;
    const schoolId = req.user.schoolId; // Ensure schoolId is attached to the request by jwtAuthMiddleware

    // Fetch the driver data with populated school and branch fields
    const driver = await DriverCollection.findOne({ _id: driverId, schoolId })
      .populate('schoolId', 'schoolName') // Populate school name
      .populate('branchId', 'branchName'); // Populate branch name

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found or does not belong to this school' });
    }

    // Create a simplified response object
    const response = {
      driverName: driver.driverName,
      phone_no: driver.phone_no,
      email: driver.email,
      address: driver.address,
      deviceId: driver.deviceId,
      busName: driver.busName,
      schoolName: driver.schoolId.schoolName, // Get schoolName from populated field
      branchName: driver.branchId ? driver.branchId.branchName : 'N/A', // Get branchName from populated field or use 'N/A' if not available
      registrationDate: driver.registrationDate
    };

    // Return the simplified driver data
    res.status(200).json({ driver: response });
=======

exports.getDriverData = async (req, res) => {
  try {
    const driverId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is part of the token payload or user info

    // Find the driver by ID and ensure it matches the school context
    const driver = await DriverCollection.findOne({ _id: driverId, schoolId });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found or does not belong to the school' });
    }

    // Return the driver data
    res.status(200).json({ driver });
>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
  } catch (error) {
    console.error('Error fetching driver data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

<<<<<<< HEAD
=======


>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
exports.updateDriver = async (req, res) => {
  try {
    const { driverName, address, phone_no, email } = req.body;
    const driverId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is part of the token payload or user info

    // Find and update the driver by ID and ensure it matches the school context
    const driver = await DriverCollection.findOneAndUpdate(
      { _id: driverId, schoolId }, // Include schoolId in the query to ensure proper association
      { driverName, address, phone_no, email },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ error: "Driver not found or does not belong to the school" });
    }

    res.status(200).json({ message: "Driver details updated successfully", driver });
  } catch (error) {
    console.error('Error updating driver details:', error);
    res.status(500).json({ error: "Error updating driver details" });
  }
};
<<<<<<< HEAD
=======


>>>>>>> b6536b20111e396bb1e323dd3a5cceff47e8aff1
exports.deleteDriver = async (req, res) => {
  try {
    const driverId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is part of the token payload or user info

    // Find and delete the driver by ID and ensure it matches the school context
    const driver = await DriverCollection.findOneAndDelete({ _id: driverId, schoolId });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found or does not belong to the school" });
    }

    res.status(200).json({ message: "Driver details deleted successfully", driver });
  } catch (error) {
    console.error('Error deleting driver details:', error);
    res.status(500).json({ error: "Error deleting driver details" });
  }
};
