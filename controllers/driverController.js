const DriverCollection = require("../models/driver");
const { generateToken } = require("../jwt");
const School = require("../models/school");
const Branch = require('../models/branch');
const Device = require('../models/device');


exports.getSchools =  async (req, res) => {
  try {
    // Fetch schools and populate their branches
    const schools = await School.find().populate('branches').exec();

    // Format the response
    const response = schools.map(school => {
      return {
        schoolName: school.schoolName,
        branches: school.branches.map(branch => ({
          branchName: branch.branchName // Extract branch names
        }))
      };
    });

    res.status(200).json({ schools: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
exports.getDevices = async (req, res) => {
  try {
    const { schoolName, branchName } = req.query;

    // Validate that required fields are present
    if (!schoolName || !branchName) {
      return res.status(400).json({ error: 'School name and branch name are required' });
    }

    // Find the school by name
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Find the branch by name within the school
    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found in the specified school' });
    }

    // Fetch all devices linked to the branch
    const devices = await Device.find({ branchId: branch._id }).lean();

    // Fetch all drivers assigned to the branch and their deviceIds
    const drivers = await DriverCollection.find({ branchId: branch._id }, 'deviceId').lean();

    // Extract deviceIds that are already assigned to drivers
    const assignedDeviceIds = drivers.map(driver => driver.deviceId);

    // Filter out devices that are already assigned
    const availableDevices = devices.filter(device => !assignedDeviceIds.includes(device.deviceId));

    // Format the response
    const response = availableDevices.map(device => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName
    }));

    res.status(200).json({ devices: response });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.registerDriver = async (req, res) => {
  try {
    const {
      driverName,
      driverMobile,
      email,
      address,
      password,
      deviceName,
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
      driverMobile,
      email,
      address,
      password, // Ensure password is hashed in schema or before saving
      deviceName,
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
exports.loginDriver = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const driver = await DriverCollection.findOne({ email });
    if (!driver) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    // Check if the password matches
    const isMatch = await driver.comparePassword(password); 
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    // Generate a JWT token with driverId, email, and schoolId
    const token = generateToken({ 
      id: driver._id, 
      email: driver.email, 
      schoolId: driver.schoolId, 
      branchId: driver.branchId   
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
};
// exports.loginDriver =  async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Find the driver by email
//     const driver = await DriverCollection.findOne({ email });

//     // Check if driver exists
//     if (!driver) {
//       return res.status(400).json({ error: "Invalid email or password" });
//     }

//     // Compare provided password with stored hashed password
//     const isMatch = await driver.comparePassword(password);

//     // Check if password matches
//     if (!isMatch) {
//       return res.status(400).json({ error: "Invalid email or password" });
//     }

//     // Check if the registration status is approved
//     if (driver.statusOfRegister !== 'approved') {
//       return res.status(400).json({ error: "Account not approved yet" });
//     }

//     // Generate JWT token with driver ID, email, and schoolId
//     const token = generateToken({
//       id: driver._id,
//       email: driver.email,
//       schoolId: driver.schoolId,
//       branchId: driver.branchId
//     });

//     // Send success response with token
//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       token: token
//     });
//   } catch (err) {
//     console.error('Error during login:', err);
//     res.status(500).json({ error: "Server error" });
//   }
// }
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
      driverMobile: driver.driverMobile,
      email: driver.email,
      address: driver.address,
      deviceId: driver.deviceId,
      deviceName: driver.deviceName,
      schoolName: driver.schoolId.schoolName, // Get schoolName from populated field
      branchName: driver.branchId ? driver.branchId.branchName : 'N/A', // Get branchName from populated field or use 'N/A' if not available
      registrationDate: driver.registrationDate
    };

    // Return the simplified driver data
    res.status(200).json({ driver: response });
  } catch (error) {
    console.error('Error fetching driver data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.updateDriver = async (req, res) => {
  try {
    const { driverName, address, driverMobile, email } = req.body;
    const driverId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is part of the token payload or user info

    // Find and update the driver by ID and ensure it matches the school context
    const driver = await DriverCollection.findOneAndUpdate(
      { _id: driverId, schoolId }, // Include schoolId in the query to ensure proper association
      { driverName, address, driverMobile, email },
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
exports.deleteDriver = async (req, res) => {
  try {
    // Extract driverId from the JWT token (assuming it's stored in req.user after JWT verification)
    const driverId = req.user.id; // or req.user.driverId if it's stored as driverId in the token

    // Find the driver by ID
    const driver = await DriverCollection.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Delete the driver
    await DriverCollection.findByIdAndDelete(driverId);

    res.status(200).json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error during driver deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


