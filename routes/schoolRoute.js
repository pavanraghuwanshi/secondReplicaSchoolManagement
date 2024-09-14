const express = require("express");
const router = express.Router();
const School = require("../models/school");
const Child = require("../models/child");
const Request = require("../models/request");
const Parent = require("../models/Parent");
const Supervisor = require("../models/supervisor");
const Attendance = require("../models/attendence");
const { schoolAuthMiddleware,generateToken } = require("../jwt");
const { decrypt } = require('../models/cryptoUtils');
const DriverCollection = require('../models/driver');
const { formatDateToDDMMYYYY } = require('../utils/dateUtils');
const jwt = require("jsonwebtoken");
const Branch = require('../models/branch');
const Geofencing = require("../models/geofence");

// Login route for schools
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the school by username
    const school = await School.findOne({ username });
    if (!school) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await school.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Generate the token using the existing function
    const token = generateToken({
      id: school._id,
      username: school.username,
      role: 'school',
      schoolName : school.schoolName,
      branchName : school.mainBranch,
      branches: school.branches
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      role: 'schooladmin'
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Add a branch to a school (superadmin)
router.post('/add-branch', schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId, branchName, email, schoolMobile, username, password } = req.body;

    // Validate school existence
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    // Check if the username is already taken
    const existingBranch = await Branch.findOne({ username });
    if (existingBranch) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different one.' });
    }

    // Create a new branch
    const newBranch = new Branch({
      branchName,
      schoolId,
      email,
      schoolMobile,
      username,
      password
    });

    const savedBranch = await newBranch.save();

    // Link the branch to the school
    await School.findByIdAndUpdate(schoolId, {
      $push: { branches: { _id: savedBranch._id, branchName: savedBranch.branchName } }
    });

    res.status(201).json({ branch: savedBranch });
  } catch (error) {
    console.error('Error adding branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// GET Branches
router.get('/branches', schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req; // Extract schoolId from the request token

    // Validate school existence
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    // Decrypt school password if it exists
    let schoolData = school.toObject();
    if (schoolData.password) {
      schoolData.password = decrypt(schoolData.password);
    }

    // Fetch branches for the specified school
    let branches = await Branch.find({ schoolId });

    // Decrypt branch passwords if they exist
    branches = branches.map(branch => {
      return {
        ...branch.toObject(), // Convert mongoose document to plain object
        password: decrypt(branch.password) // Decrypt the password
      };
    });

    res.status(200).json({ school: schoolData, branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET METHOD 
// read chilren
// router.get('/read-children', schoolAuthMiddleware, async (req, res) => {
//   try {
//     const { schoolId } = req; // Extract schoolId from token

//     // Fetch the school along with its branches based on schoolId
//     const school = await School.findById(schoolId)
//       .populate({
//         path: 'branches',
//         select: 'branchName',
//       })
//       .lean();

//     if (!school) {
//       return res.status(404).json({ error: 'School not found' });
//     }

//     const result = {
//       schoolId: school._id,
//       schoolName: school.schoolName,
//       branches: [],
//     };

//     const branchPromises = school.branches.map(async (branch) => {
//       const children = await Child.find({ branchId: branch._id })
//         .populate({
//           path: 'parentId',
//           select: 'parentName email phone',
//         })
//         .lean();

//       const formattedChildren = children.map((child) => ({
//         schoolName: school.schoolName, // Add schoolName
//         branchName: branch.branchName,  // Add branchName
//         childId: child._id,
//         childName: child.childName,
//         class: child.class,
//         rollno: child.rollno,
//         section: child.section,
//         dateOfBirth: child.dateOfBirth,
//         childAge: child.childAge,
//         pickupPoint: child.pickupPoint,
//         busName: child.busName,
//         gender: child.gender,
//         parentId: child.parentId._id,
//         parentName: child.parentId.parentName,
//         email: child.parentId.email,
//         phone: child.parentId.phone,
//         statusOfRegister: child.statusOfRegister,
//         deviceId: child.deviceId,
//         registrationDate: child.registrationDate,
//         formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
//       }));

//       result.branches.push({
//         branchId: branch._id,
//         branchName: branch.branchName,
//         children: formattedChildren,
//       });
//     });

//     await Promise.all(branchPromises);

//     res.status(200).json(result);
//   } catch (error) {
//     console.error('Error fetching school data:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.get('/read-children', schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req; // Extract schoolId from token

    // Fetch the school along with its branches based on schoolId
    const school = await School.findById(schoolId)
      .populate({
        path: 'branches',
        select: 'branchName',
      })
      .lean();

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const result = {
      schoolId: school._id,
      schoolName: school.schoolName,
      branches: [],
    };

    const branchPromises = school.branches.map(async (branch) => {
      const children = await Child.find({ branchId: branch._id })
        .populate({
          path: 'parentId',
          select: 'parentName email phone password',
        })
        .lean();

      const formattedChildren = await Promise.all(children.map(async (child) => {
        // Decrypt the parent's password
        const parent = await Parent.findById(child.parentId._id).lean();
        const password = parent ? decrypt(parent.password) : '';

        return {
          schoolName: school.schoolName, // Add schoolName
          branchName: branch.branchName,  // Add branchName
          childId: child._id,
          childName: child.childName,
          class: child.class,
          rollno: child.rollno,
          section: child.section,
          dateOfBirth: child.dateOfBirth,
          childAge: child.childAge,
          pickupPoint: child.pickupPoint,
          busName: child.busName,
          gender: child.gender,
          parentId: child.parentId._id,
          parentName: child.parentId.parentName,
          email: child.parentId.email,
          phone: child.parentId.phone,
          password, // Include decrypted password here
          statusOfRegister: child.statusOfRegister,
          deviceId: child.deviceId,
          registrationDate: child.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
        };
      }));

      result.branches.push({
        branchId: branch._id,
        branchName: branch.branchName,
        children: formattedChildren,
      });
    });

    await Promise.all(branchPromises);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching school data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// get parents
router.get('/read-parents', schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req; // Extract schoolId from the request token

    // Fetch the school to include the school name
    const school = await School.findById(schoolId).lean();

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Fetch all parents for the specific school and populate branch and child details
    const parents = await Parent.find({ schoolId })
      .populate({
        path: 'branchId', // Populate branch details
        select: 'branchName',
      })
      .populate({
        path: 'children', // Populate child details
        select: 'childName' // Adjust as needed
      })
      .lean();

    // Transform and group parents by branch
    const branchesMap = {};

    parents.forEach(parent => {
      if (parent.branchId) {
        const branchId = parent.branchId._id.toString();

        if (!branchesMap[branchId]) {
          branchesMap[branchId] = {
            branchId: branchId,
            branchName: parent.branchId.branchName,
            parents: []
          };
        }

        branchesMap[branchId].parents.push({
          parentId: parent._id,
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          address: parent.address,
          password: decrypt(parent.password), // Decrypt the password
          registrationDate: formatDateToDDMMYYYY(new Date(parent.parentRegistrationDate)),
          statusOfRegister: parent.statusOfRegister, // Add statusOfRegister field
          schoolId: school._id, // Add schoolId to parent data
          schoolName: school.schoolName, // Add schoolName to parent data
          children: parent.children.map(child => ({
            childId: child._id,
            childName: child.childName
          })) // Add child details to parent data
        });
      }
    });

    // Convert branchesMap to an array
    const branches = Object.values(branchesMap);

    res.status(200).json({
      schoolId: school._id,
      schoolName: school.schoolName,
      branches,
    });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all pending requests
router.get("/pending-requests", schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req;

    // Fetch the school to include the school name
    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Fetch all pending requests for the specific school
    const requests = await Request.find({
      statusOfRequest: "pending",
      schoolId,
    })
      .populate({
        path: "childId",
        populate: {
          path: "schoolId branchId",
          select: "schoolName branchName", // Only include the names
        },
        select: "childName class schoolId branchId deviceId", // Ensure we get the schoolId and branchId
      })
      .populate("parentId", "parentName email phone password parentRegistrationDate")
      .lean();

    // Filter out requests where the parent or child does not exist
    const validRequests = requests.filter(
      (request) => request.parentId && request.childId
    );

    // Group requests by branch
    const branchesMap = {};

    validRequests.forEach(request => {
      const branchId = request.childId.branchId?._id.toString();
      const branchName = request.childId.branchId?.branchName || "Unknown Branch";

      const formattedRequest = {
        requestId: request._id,
        reason: request.reason,
        class: request.childId.class,
        statusOfRequest: request.statusOfRequest,
        parentId: request.parentId._id,
        parentName: request.parentId.parentName,
        phone: request.parentId.phone,
        email: request.parentId.email,
        childId: request.childId._id,
        childName: request.childId.childName,
        requestType: request.requestType,
        //deviceId: request.deviceId || null,
        requestDate: request.requestDate,
        deviceId: request.childId.deviceId,
        requestDate: request.requestDate
          ? formatDateToDDMMYYYY(new Date(request.requestDate))
          : null,
      };

      // Add fields conditionally based on the request type
      if (request.requestType === "leave") {
        formattedRequest.startDate = request.startDate
          ? formatDateToDDMMYYYY(new Date(request.startDate))
          : null;
        formattedRequest.endDate = request.endDate
          ? formatDateToDDMMYYYY(new Date(request.endDate))
          : null;
        formattedRequest.newRoute = null;
      } else if (request.requestType === "changeRoute") {
        formattedRequest.newRoute = request.newRoute || null;
        formattedRequest.startDate = null;
        formattedRequest.endDate = null;
      } else {
        formattedRequest.startDate = null;
        formattedRequest.endDate = null;
        formattedRequest.newRoute = null;
      }

      // If the branch does not exist in the map, add it
      if (!branchesMap[branchId]) {
        branchesMap[branchId] = {
          branchId,
          branchName,
          requests: [],
        };
      }

      // Add the request to the respective branch
      branchesMap[branchId].requests.push(formattedRequest);
    });

    // Convert the branchesMap object into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: school._id,
      schoolName: school.schoolName,
      branches,
    };

    // Send the formatted requests as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
// Get all approved requests
router.get("/approved-requests", schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req;

    // Fetch the school details
    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const schoolName = school.schoolName;

    // Fetch all approved requests for the specific school
    const requests = await Request.find({ statusOfRequest: "approved", schoolId })
      .populate("parentId", "parentName email phone password parentRegistrationDate")
      .populate({
        path: "childId",
        populate: {
          path: "branchId",
          select: "branchName", // Populate branchName
        },
        select: "childName class branchId",
      })
      .lean();

    // Filter out requests where the parent or child does not exist
    const validRequests = requests.filter(request => request.parentId && request.childId);

    // Group requests by branch
    const branchesMap = {};

    // Fetch branch details and format requests
    await Promise.all(validRequests.map(async (request) => {
      const branch = await Branch.findById(request.childId.branchId).lean();
      const branchName = branch ? branch.branchName : "Unknown Branch";

      const formattedRequest = {
        requestId: request._id,
        reason: request.reason,
        class: request.childId.class,
        statusOfRequest: request.statusOfRequest,
        parentId: request.parentId._id,
        parentName: request.parentId.parentName,
        phone: request.parentId.phone,
        email: request.parentId.email,
        childId: request.childId._id,
        childName: request.childId.childName,
        requestType: request.requestType,
        requestDate: request.requestDate,
        schoolName: schoolName, // Include schoolName
        branchName: branchName, // Include branchName
        formattedRequestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null,
      };

      // Add fields conditionally based on the request type
      if (request.requestType === 'leave') {
        formattedRequest.startDate = request.startDate || null;
        formattedRequest.endDate = request.endDate || null;
        formattedRequest.newRoute = null; // Ensure newRoute is not included for leave requests
      } else if (request.requestType === 'changeRoute') {
        formattedRequest.newRoute = request.newRoute || null;
        formattedRequest.startDate = null; // Ensure startDate and endDate are not included for changeRoute requests
        formattedRequest.endDate = null;
      } else {
        formattedRequest.startDate = null;
        formattedRequest.endDate = null;
        formattedRequest.newRoute = null;
      }

      // If the branch does not exist in the map, add it
      if (!branchesMap[request.childId.branchId]) {
        branchesMap[request.childId.branchId] = {
          branchId: request.childId.branchId,
          branchName: branchName,
          requests: [],
        };
      }

      // Add the request to the respective branch
      branchesMap[request.childId.branchId].requests.push(formattedRequest);
    }));

    // Convert the branchesMap object into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: school._id,
      schoolName: school.schoolName,
      branches,
    };

    // Send the formatted requests as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
// Get all children with denied requests
router.get('/denied-requests', schoolAuthMiddleware, async (req, res) => {
  try {
    const { schoolId } = req;

    // Fetch the school details
    const school = await School.findById(schoolId).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const schoolName = school.schoolName;

    // Fetch all denied requests for the specific school
    const deniedRequests = await Request.find({ statusOfRequest: 'denied', schoolId })
      .populate("parentId", "parentName email phone")
      .populate({
        path: 'childId',
        populate: {
          path: 'branchId',
          select: 'branchName', // Populate branchName
        },
        select: 'childName deviceId class branchId',
      })
      .lean();

    // Filter out requests where parentId or childId is null or not populated
    const validRequests = deniedRequests.filter(request => request.parentId && request.childId);

    // Group requests by branch
    const branchesMap = {};

    // Format requests and group by branch
    await Promise.all(validRequests.map(async request => {
      const branch = await Branch.findById(request.childId.branchId).lean();
      const branchName = branch ? branch.branchName : "Unknown Branch";

      const formattedRequest = {
        childId: request.childId._id,
        childName: request.childId.childName,
        deviceId: request.childId.deviceId,
        class: request.childId.class,
        statusOfRequest: request.statusOfRequest,
        parentName: request.parentId.parentName,
        email: request.parentId.email,
        phone: request.parentId.phone,
        requestDate: request.requestDate,
        formattedRequestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null, // Formatted request date
        schoolName: schoolName, // Include schoolName
        branchName: branchName, // Include branchName
      };

      // If the branch does not exist in the map, add it
      if (!branchesMap[request.childId.branchId]) {
        branchesMap[request.childId.branchId] = {
          branchId: request.childId.branchId,
          branchName: branchName,
          requests: [],
        };
      }

      // Add the request to the respective branch
      branchesMap[request.childId.branchId].requests.push(formattedRequest);
    }));

    // Convert the branchesMap object into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: school._id,
      schoolName: school.schoolName,
      branches,
    };

    // Send the formatted requests as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching denied requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get all drivers 
router.get('/read-drivers', schoolAuthMiddleware, async (req, res) => {
  const { schoolId } = req;

  try {
    // Fetch drivers associated with the specific school and populate the school and branch names
    const drivers = await DriverCollection.find({ schoolId })
      .populate('schoolId', 'schoolName') // Populate schoolName from the School collection
      .populate('branchId', 'branchName') // Populate branchName from the Branch collection
      .lean(); // Use .lean() to get plain JavaScript objects

    // Group drivers by branch
    const branchesMap = {};

    // Format driver data and group by branch
    const driverData = drivers.map(driver => {
      try {
        console.log(`Decrypting password for driver: ${driver.driverName}, encryptedPassword: ${driver.password}`);
        const decryptedPassword = decrypt(driver.password);

        const formattedDriver = {
          id: driver._id,
          driverName: driver.driverName,
          address: driver.address,
          driverMobile: driver.driverMobile,
          email: driver.email,
          deviceId: driver.deviceId,
          password: decryptedPassword,
          registrationDate: driver.registrationDate,
          formattedRegistrationDate: driver.registrationDate ? formatDateToDDMMYYYY(new Date(driver.registrationDate)) : null,
          schoolName: driver.schoolId ? driver.schoolId.schoolName : 'N/A', // Include the school name
          branchName: driver.branchId ? driver.branchId.branchName : 'N/A' // Include the branch name
        };

        // If the branch does not exist in the map, add it
        if (!branchesMap[driver.branchId._id]) {
          branchesMap[driver.branchId._id] = {
            branchId: driver.branchId._id,
            branchName: driver.branchId.branchName,
            drivers: []
          };
        }

        // Add the driver to the respective branch
        branchesMap[driver.branchId._id].drivers.push(formattedDriver);

        return null; // We're using branchesMap to collect driver data
      } catch (decryptError) {
        console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
        return null;
      }
    }).filter(driver => driver !== null);

    // Convert the branchesMap object into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: schoolId,
      schoolName: drivers.length > 0 ? drivers[0].schoolId.schoolName : 'N/A',
      branches
    };

    // Send the formatted drivers as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get all supervisor
router.get('/read-supervisors', schoolAuthMiddleware, async (req, res) => {
  const { schoolId } = req;

  try {
    // Fetch supervisors associated with the specific school and populate both school name and branch name
    const supervisors = await Supervisor.find({ schoolId })
      .populate('schoolId', 'schoolName') // Populate the schoolId field with schoolName
      .populate('branchId', 'branchName') // Populate the branchId field with branchName
      .lean();

    // Group supervisors by branch
    const branchesMap = {};

    // Format supervisor data and group by branch
    const supervisorData = supervisors.map(supervisor => {
      try {
        console.log(`Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`);
        const decryptedPassword = decrypt(supervisor.password);
        
        const formattedSupervisor = {
          id: supervisor._id,
          supervisorName: supervisor.supervisorName,
          address: supervisor.address,
          phone_no: supervisor.phone_no,
          email: supervisor.email,
          deviceId: supervisor.deviceId,
          password: decryptedPassword,
          registrationDate: supervisor.registrationDate,
          formattedRegistrationDate: supervisor.registrationDate ? formatDateToDDMMYYYY(new Date(supervisor.registrationDate)) : null,
          schoolName: supervisor.schoolId ? supervisor.schoolId.schoolName : 'N/A', // Include school name
          branchName: supervisor.branchId ? supervisor.branchId.branchName : 'Branch not found', // Include branch name
        };

        // If the branch does not exist in the map, add it
        if (!branchesMap[supervisor.branchId._id]) {
          branchesMap[supervisor.branchId._id] = {
            branchId: supervisor.branchId._id,
            branchName: supervisor.branchId.branchName,
            supervisors: []
          };
        }

        // Add the supervisor to the respective branch
        branchesMap[supervisor.branchId._id].supervisors.push(formattedSupervisor);

        return null; // We're using branchesMap to collect supervisor data
      } catch (decryptError) {
        console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
        return null;
      }
    }).filter(supervisor => supervisor !== null);

    // Convert the branchesMap object into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: schoolId,
      schoolName: supervisors.length > 0 ? supervisors[0].schoolId.schoolName : 'N/A',
      branches
    };

    // Send the formatted supervisors as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get data by deviceId for a superadmin
router.get('/data-by-deviceId', schoolAuthMiddleware, async (req, res) => {
  const { deviceId } = req.body;
  const { schoolId } = req;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  try {
    // Fetch all branches associated with the authenticated school
    const branches = await Branch.find({ schoolId }).lean();

    // Initialize a map to hold the branch-wise data
    const branchesMap = {};

    // Fetch data for each branch
    await Promise.all(
      branches.map(async (branch) => {
        const branchId = branch._id;
        const branchName = branch.branchName;

        // Fetch Supervisor data for the branch
        const supervisor = await Supervisor.findOne({ deviceId, schoolId, branchId }).lean();
        let supervisorData = {};
        if (supervisor) {
          try {
            console.log(`Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`);
            const decryptedPassword = decrypt(supervisor.password);
            supervisorData = {
              id: supervisor._id,
              supervisorName: supervisor.supervisorName,
              address: supervisor.address,
              phone_no: supervisor.phone_no,
              email: supervisor.email,
              deviceId: supervisor.deviceId,
              password: decryptedPassword,
              registrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate)),
            };
          } catch (decryptError) {
            console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
          }
        }

        // Fetch Driver data for the branch
        const driver = await DriverCollection.findOne({ deviceId, schoolId, branchId }).lean();
        let driverData = {};
        if (driver) {
          try {
            console.log(`Decrypting password for driver: ${driver.driverName}, encryptedPassword: ${driver.password}`);
            const decryptedPassword = decrypt(driver.password);
            driverData = {
              id: driver._id,
              driverName: driver.driverName,
              address: driver.address,
              phone_no: driver.phone_no,
              email: driver.email,
              deviceId: driver.deviceId,
              password: decryptedPassword,
              registrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate)),
            };
          } catch (decryptError) {
            console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
          }
        }

        // Fetch Child data for the branch
        const children = await Child.find({ deviceId, schoolId, branchId }).lean();
        const transformedChildren = await Promise.all(
          children.map(async (child) => {
            let parentData = {};
            if (child.parentId) {
              const parent = await Parent.findById(child.parentId).lean();
              parentData = {
                parentName: parent ? parent.parentName : null,
                email: parent ? parent.email : null,
                phone: parent ? parent.phone : null,
                parentId: parent ? parent._id : null,
              };
            }

            return {
              ...child,
              ...parentData,
              formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
            };
          })
        );

        // Populate the branch data in the map
        if (!branchesMap[branchId]) {
          branchesMap[branchId] = {
            branchId: branchId,
            branchName: branchName,
            supervisor: supervisorData,
            driver: driverData,
            children: transformedChildren
          };
        }
      })
    );

    // Convert the branchesMap object into an array of branches
    const branchesData = Object.values(branchesMap);

    // Prepare the final response data
    const responseData = {
      schoolId: schoolId,
      schoolName: (branches.length > 0 && branches[0].schoolId) ? branches[0].schoolId.schoolName : 'N/A',
      branches: branchesData
    };

    // Send the formatted data as a JSON response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching data by deviceId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/geofences', async (req, res) => {
  try {
    // Fetch all geofences
    const geofences = await Geofencing.find();

    // Group geofences by deviceId and include "deviceId" as a key
    const groupedGeofences = geofences.reduce((acc, geofence) => {
      const deviceId = geofence.deviceId.toString(); // Ensure deviceId is a string for consistency
      if (!acc[deviceId]) {
        acc[deviceId] = [];
      }
      acc[deviceId].push({
        _id: geofence._id,
        name: geofence.name,
        area: geofence.area,
        isCrossed: geofence.isCrossed,
        deviceId: geofence.deviceId,
        __v: geofence.__v
      });
      return acc;
    }, {});

    // Transform groupedGeofences to include "deviceId" key in the format required
    const transformedResponse = Object.entries(groupedGeofences).reduce((acc, [deviceId, geofences]) => {
      acc[`deviceId: ${deviceId}`] = geofences;
      return acc;
    }, {});

    // Respond with the transformed geofences
    res.status(200).json(transformedResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving geofences', error });
  }
});
// Get a specific geofence by deviceId
router.get("/geofence", async (req, res) => {
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

const convertDate = (dateStr) => {
  const dateParts = dateStr.split('-');
  const jsDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
  return {
    date: dateStr,
    originalDate: jsDate
  };
}
// pickupdrop 
router.get("/pickup-drop-status", schoolAuthMiddleware, async (req, res) => {
  try {
    // Extract the schoolId from the request (set by the schoolAuthMiddleware)
    const schoolId = req.schoolId;

    // Fetch attendance records only for the children associated with this schoolId
    const attendanceRecords = await Attendance.find({})
      .populate({
        path: "childId",
        match: { schoolId }, // Filter children by schoolId
        populate: [
          { path: "parentId", select: "phone" }, // Populate parentId to get the parent's phone
          { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
          { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
        ]
      })
      .lean();

    // Group children by branch
    const branchesMap = {};

    // Format and group children data
    attendanceRecords
      .filter(record => record.childId && record.childId.parentId)
      .forEach(record => {
        const { date, originalDate } = convertDate(record.date);
        const childData = {
          _id: record.childId._id,
          childName: record.childId.childName,
          class: record.childId.class,
          rollno: record.childId.rollno,
          section: record.childId.section,
          parentId: record.childId.parentId._id,
          phone: record.childId.parentId.phone,
          branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found",
          schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found",
          pickupStatus: record.pickup,
          pickupTime: record.pickupTime,
          deviceId: record.childId.deviceId,
          pickupPoint: record.childId.pickupPoint,
          dropStatus: record.drop,
          dropTime: record.dropTime,
          formattedDate: date,
          date: originalDate
        };

        // If the branch doesn't exist in the map, add it
        if (!branchesMap[record.childId.branchId._id]) {
          branchesMap[record.childId.branchId._id] = {
            branchId: record.childId.branchId._id,
            branchName: record.childId.branchId.branchName,
            children: []
          };
        }

        // Add the child data to the respective branch
        branchesMap[record.childId.branchId._id].children.push(childData);
      });

    // Convert branchesMap into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response
    const responseData = {
      schoolId: schoolId,
      schoolName: attendanceRecords.length > 0 ? attendanceRecords[0].childId.schoolId.schoolName : 'N/A',
      branches
    };

    // Send the response
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// present child during 
router.get("/present-children", schoolAuthMiddleware, async (req, res) => {
  try {
    // Extract the schoolId from the request (set by the schoolAuthMiddleware)
    const schoolId = req.schoolId;

    // Fetch attendance records for children present at pickup and associated with this schoolId
    const attendanceRecords = await Attendance.find({ pickup: true })
      .populate({
        path: "childId",
        match: { schoolId }, // Filter children by schoolId
        populate: [
          { path: "parentId", select: "phone" }, // Populate parentId to get the parent's phone
          { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
          { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
        ]
      })
      .lean(); // Use lean() to get plain JavaScript objects

    // Group data by branches
    const branchMap = {};

    attendanceRecords.forEach(record => {
      const branchId = record.childId.branchId ? record.childId.branchId._id : 'unknown';
      
      if (!branchMap[branchId]) {
        branchMap[branchId] = {
          branchId: branchId,
          branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found",
          children: []
        };
      }

      const childData = {
        _id: record.childId._id,
        childName: record.childId.childName,
        class: record.childId.class,
        rollno: record.childId.rollno,
        section: record.childId.section,
        parentId: record.childId.parentId ? record.childId.parentId._id : null,
        phone: record.childId.parentId ? record.childId.parentId.phone : null,
        branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found",
        schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found",
        pickupStatus: record.pickup,
        pickupTime: record.pickupTime,
        deviceId: record.childId.deviceId,
        pickupPoint: record.childId.pickupPoint,
        formattedDate: convertDate(record.date).date,
        date: convertDate(record.date).originalDate
      };

      branchMap[branchId].children.push(childData);
    });

    // Format the final response
    const branches = Object.values(branchMap);

    const responseData = {
      schoolId: schoolId,
      schoolName: (await School.findById(schoolId)).schoolName,
      branches: branches
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// router.get("/absent-children", schoolAuthMiddleware, async (req, res) => {
//   try {
//     // Extract the schoolId from the request (set by the schoolAuthMiddleware)
//     const schoolId = req.schoolId;

//     // Fetch attendance records for children absent at pickup and associated with this schoolId
//     const attendanceRecords = await Attendance.find({ pickup: false })
//       .populate({
//         path: "childId",
//         match: { schoolId }, // Filter children by schoolId
//         populate: [
//           { path: "parentId", select: "phone" }, // Populate parentId to get the parent's phone
//           { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
//           { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
//         ]
//       })
//       .lean(); // Use lean() to get plain JavaScript objects

//     // Filter and map the data for the response
//     const childrenData = attendanceRecords
//       .filter(record => record.childId && record.childId.parentId)
//       .map(record => {
//         const { date, originalDate } = convertDate(record.date);

//         return {
//           _id: record.childId._id,
//           childName: record.childId.childName,
//           class: record.childId.class,
//           rollno: record.childId.rollno,
//           section: record.childId.section,
//           parentId: record.childId.parentId._id,
//           phone: record.childId.parentId.phone,
//           branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found", // Include branch name
//           schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found", // Include school name
//           pickupStatus: record.pickup,
//           pickupTime: record.pickupTime,
//           deviceId: record.childId.deviceId,
//           pickupPoint: record.childId.pickupPoint,
//           formattedDate: date,
//           date: originalDate
//         };
//       });

//     res.status(200).json({ children: childrenData });
//   } catch (error) {
//     console.error("Error fetching absent children data:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });



// status
router.get("/absent-children", schoolAuthMiddleware, async (req, res) => {
  try {
    // Extract the schoolId from the request (set by the schoolAuthMiddleware)
    const schoolId = req.schoolId;

    // Fetch attendance records for children absent at pickup and associated with this schoolId
    const attendanceRecords = await Attendance.find({ pickup: false })
      .populate({
        path: "childId",
        match: { schoolId }, // Filter children by schoolId
        populate: [
          { path: "parentId", select: "phone" }, // Populate parentId to get the parent's phone
          { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
          { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
        ]
      })
      .lean(); // Use lean() to get plain JavaScript objects

    // Group data by branches
    const branchMap = {};

    attendanceRecords.forEach(record => {
      const branchId = record.childId.branchId ? record.childId.branchId._id : 'unknown';
      
      if (!branchMap[branchId]) {
        branchMap[branchId] = {
          branchId: branchId,
          branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found",
          children: []
        };
      }

      const childData = {
        _id: record.childId._id,
        childName: record.childId.childName,
        class: record.childId.class,
        rollno: record.childId.rollno,
        section: record.childId.section,
        parentId: record.childId.parentId ? record.childId.parentId._id : null,
        phone: record.childId.parentId ? record.childId.parentId.phone : null,
        branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found",
        schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found",
        pickupStatus: record.pickup,
        pickupTime: record.pickupTime,
        deviceId: record.childId.deviceId,
        pickupPoint: record.childId.pickupPoint,
        formattedDate: convertDate(record.date).date,
        date: convertDate(record.date).originalDate
      };

      branchMap[branchId].children.push(childData);
    });

    // Format the final response
    const branches = Object.values(branchMap);

    const responseData = {
      schoolId: schoolId,
      schoolName: (await School.findById(schoolId)).schoolName,
      branches: branches
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching absent children data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// router.get('/status/:childId', schoolAuthMiddleware, async (req, res) => {
//   try {
//     const { childId } = req.params;
//     const schoolId = req.schoolId;

//     // Find the child within the specified school and populate branch and parent details
//     const child = await Child.findOne({ _id: childId, schoolId })
//       .populate({
//         path: 'parentId',
//         select: 'parentName phone'
//       })
//       .populate({
//         path: 'branchId', // Populate branchId field
//         select: 'branchName'
//       })
//       .populate({
//         path: 'schoolId', // Populate schoolId field
//         select: 'schoolName'
//       })
//       .lean(); // Convert to plain JavaScript object

//     if (!child) {
//       return res.status(404).json({ message: 'Child not found' });
//     }

//     const parent = child.parentId;

//     // Fetch the most recent attendance record for the child
//     const attendance = await Attendance.findOne({ childId })
//       .sort({ date: -1 })
//       .limit(1);

//     // Fetch the most recent request for the child
//     const request = await Request.findOne({ childId })
//       .sort({ requestDate: -1 })
//       .limit(1);

//     // Fetch the supervisor based on deviceId and schoolId
//     let supervisor = null;
//     if (child.deviceId) {
//       supervisor = await Supervisor.findOne({ deviceId: child.deviceId, schoolId });
//     }

//     // Construct the response object
//     const response = {
//       childName: child.childName,
//       childClass: child.class,
//       parentName: parent ? parent.parentName : 'Parent not found',
//       parentNumber: parent ? parent.phone : 'Parent not found',
//       branchName: child.branchId ? child.branchId.branchName : 'Branch not found',
//       schoolName: child.schoolId ? child.schoolId.schoolName : 'School not found',
//       pickupStatus: attendance ? (attendance.pickup ? 'Present' : 'Absent') : 'No record',
//       dropStatus: attendance ? (attendance.drop ? 'Present' : 'Absent') : 'No record',
//       pickupTime: attendance ? attendance.pickupTime : 'N/A',
//       dropTime: attendance ? attendance.dropTime : 'N/A',
//       date: attendance ? attendance.date : 'N/A',
//       requestType: request ? request.requestType : 'N/A',
//       startDate: request ? request.startDate || 'N/A' : 'N/A',
//       endDate: request ? request.endDate || 'N/A' : 'N/A',
//       reason: request ? request.reason || 'N/A' : 'N/A',
//       newRoute: request ? request.newRoute || 'N/A' : 'N/A',
//       statusOfRequest: request ? request.statusOfRequest || 'N/A' : 'N/A',
//       requestDate: request ? formatDateToDDMMYYYY(request.requestDate) : 'N/A',
//       supervisorName: supervisor ? supervisor.supervisorName : 'Supervisor not found'
//     };

//     // Send the response
//     res.json(response);
//   } catch (error) {
//     console.error('Error fetching child status:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// POST METHOD
//review request
router.get('/status-of-children', schoolAuthMiddleware, async (req, res) => {
  try {
    const schoolId = req.schoolId;

    // Fetch all children associated with the school and populate branch, parent, and school details
    const children = await Child.find({ schoolId })
      .populate({
        path: 'parentId',
        select: 'parentName phone'
      })
      .populate({
        path: 'branchId',
        select: 'branchName'
      })
      .populate({
        path: 'schoolId',
        select: 'schoolName'
      })
      .lean(); // Convert to plain JavaScript object

    if (children.length === 0) {
      return res.status(404).json({ message: 'No children found for this school' });
    }

    // Group children by branch
    const branchesMap = {};

    // Loop over each child to fetch related data (attendance, request, supervisor)
    for (const child of children) {
      const parent = child.parentId;

      // Fetch the most recent attendance record for each child
      const attendance = await Attendance.findOne({ childId: child._id })
        .sort({ date: -1 })
        .lean();

      // Fetch the most recent request for each child
      const request = await Request.findOne({ childId: child._id })
        .sort({ requestDate: -1 })
        .lean();

      // Fetch the supervisor based on deviceId and schoolId
      let supervisor = null;
      if (child.deviceId) {
        supervisor = await Supervisor.findOne({ deviceId: child.deviceId, schoolId }).lean();
      }

      // Prepare the child status data
      const childData = {
        childId: child._id,
        childName: child.childName,
        childClass: child.class,
        parent: {
          parentName: parent ? parent.parentName : 'Parent not found',
          parentNumber: parent ? parent.phone : 'Parent not found'
        },
        pickupStatus: attendance ? (attendance.pickup ? 'Present' : 'Absent') : 'No record',
        dropStatus: attendance ? (attendance.drop ? 'Present' : 'Absent') : 'No record',
        pickupTime: attendance ? attendance.pickupTime : 'N/A',
        dropTime: attendance ? attendance.dropTime : 'N/A',
        date: attendance ? attendance.date : 'N/A',
        request: {
          requestType: request ? request.requestType : 'N/A',
          startDate: request ? request.startDate || 'N/A' : 'N/A',
          endDate: request ? request.endDate || 'N/A' : 'N/A',
          reason: request ? request.reason || 'N/A' : 'N/A',
          newRoute: request ? request.newRoute || 'N/A' : 'N/A',
          statusOfRequest: request ? request.statusOfRequest || 'N/A' : 'N/A',
          requestDate: request ? formatDateToDDMMYYYY(request.requestDate) : 'N/A'
        },
        supervisorName: supervisor ? supervisor.supervisorName : 'Supervisor not found'
      };

      // Group children by branch
      if (!branchesMap[child.branchId._id]) {
        branchesMap[child.branchId._id] = {
          branchId: child.branchId._id,
          branchName: child.branchId.branchName,
          children: []
        };
      }

      // Add the child to the respective branch
      branchesMap[child.branchId._id].children.push(childData);
    }

    // Convert the branchesMap into an array of branches
    const branches = Object.values(branchesMap);

    // Prepare the final response object
    const response = {
      schoolId: schoolId,
      schoolName: children[0].schoolId ? children[0].schoolId.schoolName : 'N/A',
      branches
    };

    // Send the response
    res.json(response);
  } catch (error) {
    console.error('Error fetching all children status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post("/review-request/:requestId",schoolAuthMiddleware,async (req, res) => {
    try {
      const { statusOfRequest } = req.body;
      const { requestId } = req.params;
      const { schoolId } = req;

      if (!["approved", "denied"].includes(statusOfRequest)) {
        return res.status(400).json({ error: "Invalid statusOfRequest" });
      }

      const request = await Request.findById(requestId);
      // Check if the request belongs to the school
      if (request.schoolId.toString() !== schoolId.toString()) {
        return res
          .status(403)
          .json({ error: "Unauthorized to review this request" });
      }
      request.statusOfRequest = statusOfRequest;

      if (
        statusOfRequest === "approved" &&
        request.requestType === "changeRoute"
      ) {
        const child = await Child.findById(request.childId);
        if (!child) {
          return res.status(404).json({ error: "Child not found" });
        }
        child.deviceId = request.newRoute;
        await child.save();
      }
      await request.save();

      const today = new Date();
      const formattedDate = formatDateToDDMMYYYY(today);
      const formattedRequestDate = formatDateToDDMMYYYY(
        new Date(request.requestDate)
      );

      // Assuming notifyParent is a function to send notifications
      const notifyParent = (parentId, message) => {
        // Your notification logic here
        console.log(`Notification to parentId ${parentId}: ${message}`);
      };

      notifyParent(
        request.parentId,
        `Your request has been ${statusOfRequest}.`
      );

      res.status(200).json({
        message: `Request reviewed successfully on ${formattedDate}`,
        request: {
          ...request.toObject(),
          formattedRequestDate,
        },
      });
    } catch (error) {
      console.error("Error reviewing request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);


// registration status
router.post('/registerStatus/:parentId/', schoolAuthMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { action } = req.body;
    const { schoolId } = req; // Assuming schoolId is added to req by schoolAuthMiddleware

    // Find the parent by ID and check if they belong to the correct school
    const parent = await Parent.findOne({ _id: parentId, schoolId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to this school' });
    }

    // Update the registration status based on the action
    if (action === 'approve') {
      parent.statusOfRegister = 'approved';
    } else if (action === 'reject') {
      parent.statusOfRegister = 'rejected';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await parent.save();

    res.status(200).json({ message: `Registration ${action}d successfully.` });
  } catch (error) {
    console.error('Error during registration status update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//PUT METHOD
// Update child information
router.put('/update-child/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const { deviceId, ...updateFields } = req.body;
  const { schoolId } = req; // Assuming schoolId is added to req by schoolAuthMiddleware

  try {
    // Find the child by ID and check if they belong to the correct school
    const child = await Child.findOne({ _id: childId, schoolId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to this school' });
    }

    // Update fields
    if (deviceId) {
      child.deviceId = deviceId;
    }
    Object.keys(updateFields).forEach((field) => {
      child[field] = updateFields[field];
    });
    await child.save();

    // Fetch updated child data with parent info
    const updatedChild = await Child.findById(childId).lean();
    let parentData = {};
    if (updatedChild.parentId) {
      const parent = await Parent.findById(updatedChild.parentId).lean();
      parentData = {
        parentName: parent ? parent.parentName : null,
        email: parent ? parent.email : null,
        phone: parent ? parent.phone : null,
        parentId: parent ? parent._id : null,
      };
    } else {
      parentData = {
        parentName: null,
        email: null,
        phone: null,
        parentId: null,
      };
    }

    const transformedChild = {
      ...updatedChild,
      ...parentData,
      formattedRegistrationDate: formatDateToDDMMYYYY(new Date(updatedChild.registrationDate)),
    };

    res.status(200).json({ message: 'Child information updated successfully', child: transformedChild });
  } catch (error) {
    console.error('Error updating child information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//update the parents
router.put('/update-parent/:id', schoolAuthMiddleware, async (req, res) => {
  const parentId = req.params.id;
  const { parentName, email, password, phone } = req.body;
  const { schoolId } = req; // Assuming schoolId is added to req by schoolAuthMiddleware

  try {
    // Find the parent by ID and check if they belong to the correct school
    const parent = await Parent.findOne({ _id: parentId, schoolId });
    
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to this school' });
    }

    // Update only the allowed fields
    if (parentName) parent.parentName = parentName;
    if (email) parent.email = email;
    if (phone) parent.phone = phone;
    if (password) parent.password = password; // Ensure you handle password encryption properly

    // Save the updated parent
    await parent.save();
    
    res.status(200).json({
      message: 'Parent updated successfully',
      parent: {
        ...parent.toObject(),
      },
    });
  } catch (error) {
    console.error('Error updating parent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// update driver
router.put('/update-driver/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const schoolId = req.schoolId; // Get the schoolId from the middleware
    const { deviceId, ...updateFields } = req.body;

    // Find the driver by ID and schoolId
    const driver = await DriverCollection.findOne({ _id: driverId, schoolId });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Update deviceId if provided
    if (deviceId) {
      driver.deviceId = deviceId;
    }

    // Update other fields
    Object.keys(updateFields).forEach((field) => {
      driver[field] = updateFields[field];
    });

    // Save the updated driver
    await driver.save();

    // Fetch updated driver data with decrypted password
    const updatedDriver = await DriverCollection.findById(driverId).lean();
    let decryptedPassword = '';
    try {
      console.log(`Decrypting password for driver: ${updatedDriver.driverName}, encryptedPassword: ${updatedDriver.password}`);
      decryptedPassword = decrypt(updatedDriver.password);
    } catch (decryptError) {
      console.error(`Error decrypting password for driver: ${updatedDriver.driverName}`, decryptError);
    }

    const transformedDriver = {
      ...updatedDriver,
      password: decryptedPassword,
      registrationDate: formatDateToDDMMYYYY(new Date(updatedDriver.registrationDate))
    };

    console.log('Updated driver data:', JSON.stringify(transformedDriver, null, 2));
    res.status(200).json({ message: 'Driver information updated successfully', drivers: transformedDriver });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// update the supervsior
router.put('/update-supervisor/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const schoolId = req.schoolId; // Get the schoolId from the middleware
    const { deviceId, ...updateFields } = req.body;

    // Find the supervisor by ID and schoolId
    const supervisor = await Supervisor.findOne({ _id: supervisorId, schoolId });
    if (!supervisor) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    // Update deviceId if provided
    if (deviceId) {
      supervisor.deviceId = deviceId;
    }

    // Update other fields
    Object.keys(updateFields).forEach((field) => {
      supervisor[field] = updateFields[field];
    });

    // Save the updated supervisor
    await supervisor.save();

    // Fetch updated supervisor data with decrypted password
    const updatedSupervisor = await Supervisor.findById(supervisorId).lean();
    let decryptedPassword = '';
    try {
      console.log(`Decrypting password for supervisor: ${updatedSupervisor.supervisorName}, encryptedPassword: ${updatedSupervisor.password}`);
      decryptedPassword = decrypt(updatedSupervisor.password);
    } catch (decryptError) {
      console.error(`Error decrypting password for supervisor: ${updatedSupervisor.supervisorName}`, decryptError);
    }

    const transformedSupervisor = {
      ...updatedSupervisor,
      password: decryptedPassword,
      registrationDate: formatDateToDDMMYYYY(new Date(updatedSupervisor.registrationDate))
    };

    console.log('Updated supervisor data:', JSON.stringify(transformedSupervisor, null, 2));
    res.status(200).json({ message: 'Supervisor information updated successfully', supervisors: transformedSupervisor });
  } catch (error) {
    console.error('Error updating supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// DELETE METHOD
// Delete child
router.delete('/delete/child/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const { schoolId } = req; // Assuming schoolId is added to req by schoolAuthMiddleware

  try {
    // Find the child by ID and check if they belong to the correct school
    const child = await Child.findOne({ _id: childId, schoolId }).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to this school' });
    }

    let parentData = {};
    if (child.parentId) {
      // Find the parent and ensure they belong to the same school
      const parent = await Parent.findOne({ _id: child.parentId, schoolId }).lean();
      if (parent) {
        parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id,
        };

        // Check if the parent has any other children
        const childCount = await Child.countDocuments({ parentId: child.parentId, schoolId });
        if (childCount === 1) {
          await Parent.findByIdAndDelete(child.parentId);
        }
      }
    }

    // Delete the child
    await Child.findByIdAndDelete(childId);

    console.log('Deleted child data:', JSON.stringify(child, null, 2));
    if (parentData.parentId) {
      console.log('Associated parent data:', JSON.stringify(parentData, null, 2));
    }

    res.status(200).json({
      message: 'Child deleted successfully',
      child,
      parent: parentData,
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// delete parents
router.delete('/delete-parent/:id', schoolAuthMiddleware, async (req, res) => {
  const parentId = req.params.id;
  const { schoolId } = req;

  try {
    // Find the parent by ID and ensure they belong to the correct school
    const parent = await Parent.findOne({ _id: parentId, schoolId }).lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to this school' });
    }

    // Delete all children associated with the parent and ensure they belong to the same school
    await Child.deleteMany({ _id: { $in: parent.children }, schoolId });

    // Delete the parent
    await Parent.findByIdAndDelete(parentId);

    res.status(200).json({ message: 'Parent and associated children deleted successfully' });
  } catch (error) {
    console.error('Error deleting parent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// delete driver
router.delete('/delete-driver/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const schoolId = req.schoolId; // Get the schoolId from the middleware
    
    // Find and delete the driver by ID and schoolId
    const deletedDriver = await DriverCollection.findOneAndDelete({ _id: driverId, schoolId });

    if (!deletedDriver) {
      return res.status(404).json({ error: 'Driver not found or does not belong to your school' });
    }

    console.log('Deleted driver data:', JSON.stringify(deletedDriver, null, 2));
    res.status(200).json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// delete supervisor
router.delete('/delete-supervisor/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const schoolId = req.schoolId; // Get the schoolId from the middleware
    
    // Find and delete the supervisor by ID and schoolId
    const deletedSupervisor = await Supervisor.findOneAndDelete({ _id: supervisorId, schoolId });

    if (!deletedSupervisor) {
      return res.status(404).json({ error: 'Supervisor not found or does not belong to your school' });
    }

    console.log('Deleted supervisor data:', JSON.stringify(deletedSupervisor, null, 2));
    res.status(200).json({ message: 'Supervisor deleted successfully' });
  } catch (error) {
    console.error('Error deleting supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// delete branch
router.delete('/branch-delete/:branchId',schoolAuthMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branchId } = req.params;

    // Find the branch by ID
    const branch = await Branch.findById(branchId).session(session);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Delete all related data
    const parents = await Parent.find({ branchId: branch._id }).session(session);

    for (const parent of parents) {
      // Delete children associated with each parent
      await Child.deleteMany({ parentId: parent._id }).session(session);
    }

    // Delete parents associated with the branch
    await Parent.deleteMany({ branchId: branch._id }).session(session);

    // Delete supervisors and drivers associated with the branch
    await Supervisor.deleteMany({ branchId: branch._id }).session(session);
    await Driver.deleteMany({ branchId: branch._id }).session(session);

    // Finally, delete the branch itself
    await branch.remove({ session });

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ message: 'Branch and all related data deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error during branch deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
