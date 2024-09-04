const express = require('express');
const router = express.Router();
const Superadmin = require('../models/superAdmin');
const School = require("../models/school");
const {superadminMiddleware,generateToken} = require('../jwt')
const Child = require("../models/child");
const Request = require("../models/request");
const Parent = require("../models/Parent");
const { decrypt } = require('../models/cryptoUtils');
const { formatDateToDDMMYYYY } = require('../utils/dateUtils');
const Supervisor = require("../models/supervisor");
const Branch = require('../models/branch');
const Attendance = require("../models/attendence");
const DriverCollection = require('../models/driver');
const jwt = require("jsonwebtoken");




router.post('/register', async (req, res) => {
  try {
    const data = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
    };
    const { email,username } = data;
    console.log("Received registration data:", data);

    const existingSuperadmin = await Superadmin.findOne({ $or: [{ email }, { username }] });
    if (existingSuperadmin) {
      console.log("Email or username  already exists");
      return res.status(400).json({ error: "Email or username already exists" });
    }

    const newSuperadmin = new Superadmin(data);
    const response = await newSuperadmin.save();
    console.log("Data saved:", response);

    const payload = { id: response.id, email: response.email };
    const token = generateToken(payload);

    res.status(201).json({ response: { ...response.toObject(), password: undefined }, token,role:"superadmin" }); 
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post('/login',async (req, res) => {
  const { username, password } = req.body;
  try {
    const superadmin = await Superadmin.findOne({ username });
    if (!superadmin) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const isMatch = await superadmin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const token = generateToken({ id: superadmin._id, username: superadmin.username });
    res.status(200).json({ success: true, message: "Login successful", token ,role: 'superadmin'});
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// School Registration Route
// router.post('/school-register', superadminMiddleware, async (req, res) => {
//   try {  const { schoolName, username, password, email, mobileNo, branchName } = req.body;

//     const existingSchool = await School.findOne({ $or: [{ username }, { email }] });
//     if (existingSchool) {
//       return res.status(400).json({ error: 'Username or email already exists' });
//     }
//     const newSchool = new School({
//       schoolName,
//       username,
//       password,
//       email,
//       mobileNo,
//       branchName
//     });
//     const savedSchool = await newSchool.save();

//     const payload = { id: savedSchool._id, username: savedSchool.username };
//     const token = generateToken(payload);

//     res.status(201).json({ response: { ...savedSchool.toObject(), password: undefined }, token, role: "schooladmin" });
//   } catch (error) {
//     console.error('Error during registration:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

router.post('/school-register', superadminMiddleware, async (req, res) => {
  try {
    const { schoolName, username, password, email, mobileNo, mainBranch } = req.body;

    // Check if a school with the same username or email already exists
    const existingSchool = await School.findOne({ $or: [{ username }, { email }] });
    if (existingSchool) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Create the school with branchName directly included
    const newSchool = new School({
      schoolName,
      username,
      password,
      email,
      mobileNo,
      mainBranch  // Directly store mainBranch the school document
    });
    const savedSchool = await newSchool.save();

    // Generate a token and respond
    const payload = { id: savedSchool._id, username: savedSchool.username };
    const token = generateToken(payload);

    res.status(201).json({ response: { ...savedSchool.toObject(), password: undefined }, token, role: "schooladmin" });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Add a branch route
// router.post('/add-branch', superadminMiddleware, async (req, res) => {
//   try {
//     const {
//       schoolId,
//       branchName,
//       email,
//       mobileNo,
//       username,  // Username for the branch
//       password   // Password for the branch
//     } = req.body;

//     // Validate school existence
//     const school = await School.findById(schoolId);
//     if (!school) {
//       return res.status(400).json({ error: 'School not found' });
//     }

//     // Check if the username is already taken
//     const existingBranch = await Branch.findOne({ username });
//     if (existingBranch) {
//       return res.status(400).json({ error: 'Username already exists. Please choose a different one.' });
//     }

//     // Create a new branch
//     const newBranch = new Branch({
//       branchName,
//       schoolId,
//       email,
//       mobileNo,
//       username,  // Set the username for the branch
//       password   // Save the password for the branch
//     });

//     const savedBranch = await newBranch.save();

//     // Link the branch to the school
//     await School.findByIdAndUpdate(schoolId, {
//       $push: { branches: savedBranch._id }
//     });

//     res.status(201).json({ branch: savedBranch });
//   } catch (error) {
//     console.error('Error adding branch:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.post('/add-branch', superadminMiddleware, async (req, res) => {
  try {
    const { schoolId, branchName, email, mobileNo, username, password } = req.body;

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
      mobileNo,
      username,
      password
    });

    const savedBranch = await newBranch.save();

    // Link the branch to the school
    await School.findByIdAndUpdate(schoolId, {
      $push: { branches: savedBranch._id }
    });

    res.status(201).json({ branch: savedBranch });
  } catch (error) {
    console.error('Error adding branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// // View a specific branch by its ID
// router.get('/branch/:branchId', branchAuthMiddleware, async (req, res) => {
//   const { branchId } = req.params;

//   try {
//     // Fetch the branch details
//     const branch = await Branch.findById(branchId);
//     if (!branch) {
//       return res.status(404).json({ error: 'Branch not found' });
//     }

//     res.status(200).json({ branch });
//   } catch (error) {
//     console.error('Error fetching branch details:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.put('/school-edit/:schoolId', superadminMiddleware, async (req, res) => {
  const { schoolId } = req.params;
  const { schoolName, username, email, mobileNo, branch } = req.body;

  try {
    const updatedSchool = await School.findByIdAndUpdate(
      schoolId,
      { schoolName, username, email, mobileNo, branch },
      { new: true }
    );
    if (!updatedSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.status(200).json({ message: 'School updated successfully', updatedSchool });
  } catch (error) {
    console.error('Error during school update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get all children grouped by school for the superadmin
router.get('/children-by-school', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an array to hold children data by school
    const childrenBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch all branch data for this school
      const branches = await Branch.find({ schoolId: school._id }).lean();
      const branchMap = branches.reduce((map, branch) => {
        map[branch._id.toString()] = branch.branchName;
        return map;
      }, {});

      // Fetch children with populated parent data
      const children = await Child.find({ schoolId: school._id })
        .populate('parentId', 'parentName email phone password statusOfRegister')
        .lean();

      return {
        schoolName: schoolName,
        children: children.map((child) => {
          let decryptedPassword;
          try {
            decryptedPassword = decrypt(child.parentId.password);
          } catch (decryptError) {
            decryptedPassword = "Error decrypting password";
          }

          return {
            childId: child._id,
            childName: child.childName,
            class: child.class,
            rollno: child.rollno,
            section: child.section,
            schoolName: schoolName,
            branchId: child.branchId, // Include branchId in the response
            branchName: branchMap[child.branchId?.toString()] || "N/A", // Retrieve branchName from branchMap
            dateOfBirth: child.dateOfBirth,
            childAge: child.childAge,
            pickupPoint: child.pickupPoint,
            busName: child.busName,
            gender: child.gender,
            parentId: child.parentId._id,
            deviceId: child.deviceId,
            registrationDate: child.registrationDate,
            formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
            parentName: child.parentId.parentName,
            email: child.parentId.email,
            phone: child.parentId.phone,
            statusOfRegister: child.parentId.statusOfRegister,
            password: decryptedPassword,
          };
        }),
      };
    }));

    // Send the response
    res.status(200).json(childrenBySchool);
  } catch (error) {
    console.error('Error fetching children by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/getschools', superadminMiddleware, async (req, res) => {
  try {
    // Fetch schools with populated branches, including branchName
    const schools = await School.find({})
      .populate({
        path: 'branches',
        select: 'branchName mobileNo username email password', // Include branchName and other fields
      })
      .lean();

    // Decrypt school passwords and branch passwords
    const transformedSchools = await Promise.all(schools.map(async (school) => {
      let decryptedSchoolPassword;
      try {
        decryptedSchoolPassword = school.password ? decrypt(school.password) : 'No password'; // Decrypt the password if exists
      } catch (decryptError) {
        console.error(`Error decrypting password for school ${school.schoolName}`, decryptError);
        decryptedSchoolPassword = 'Error decrypting password'; // Handle decryption errors
      }

      // Ensure branches field exists before mapping
      const transformedBranches = (school.branches || []).map(async (branch) => {
        let decryptedBranchPassword;
        try {
          decryptedBranchPassword = branch.password ? decrypt(branch.password) : 'No password'; // Decrypt the password if exists
        } catch (decryptError) {
          console.error(`Error decrypting password for branch ${branch.branchName}`, decryptError);
          decryptedBranchPassword = 'Error decrypting password'; // Handle decryption errors
        }

        // Return the branch object with the decrypted password
        return {
          ...branch,
          password: decryptedBranchPassword,
        };
      });

      // Return the school object with the decrypted password and branches
      return {
        ...school,
        password: decryptedSchoolPassword,
        branches: await Promise.all(transformedBranches), // Ensure all branches are processed
      };
    }));

    // Send the response with the transformed school data
    res.status(200).json({ schools: transformedSchools });
  } catch (error) {
    console.error('Error fetching school list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all parents for all schools for the superadmin
router.get('/all-parents', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold parents data by school
    const parentsBySchool = [];

    // Iterate over each school to fetch parents
    await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch parents for the current school
      const parents = await Parent.find({ schoolId })
        .populate('children')
        .lean();

      // Transform and aggregate parents data
      const transformedParents = await Promise.all(
        parents.map(async (parent) => {
          let decryptedPassword;
          try {
            decryptedPassword = decrypt(parent.password); // Decrypt the password
            console.log(`Decrypted password for parent ${parent.parentName}: ${decryptedPassword}`);
          } catch (decryptError) {
            console.error(`Error decrypting password for parent ${parent.parentName}`, decryptError);
            decryptedPassword = "Error decrypting password"; // Handle decryption errors
          }

          // Format child dates
          const transformedChildren = parent.children.map(child => ({
            ...child,
            formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
          }));

          return {
            ...parent,
            password: decryptedPassword,
            formattedRegistrationDate: formatDateToDDMMYYYY(new Date(parent.parentRegistrationDate)),
            children: transformedChildren,
            schoolName: schoolName // Include the school name
          };
        })
      );

      // Add the parents data to the parentsBySchool array
      parentsBySchool.push({
        schoolName: schoolName,
        parents: transformedParents
      });
    }));

    // Send the response
    res.status(200).json(parentsBySchool);
  } catch (error) {
    console.error('Error fetching all parents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all pending requests for all schools for the superadmin
router.get('/all-pending-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school
    const requestsBySchool = [];

    // Iterate over each school to fetch pending requests
    await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch pending requests for the current school
      const requests = await Request.find({
        statusOfRequest: "pending",
        schoolId,
      })
        .populate({
          path: "childId",
          populate: {
            path: "branchId",
            select: "branchName", // Only include the branchName
          },
          select: "childName class branchId deviceId", // Ensure we get the branchId and deviceId
        })
        .populate("parentId", "parentName email phone")
        .lean();

      // Filter out requests where the parent or child does not exist
      const validRequests = requests.filter(
        (request) => request.parentId && request.childId
      );

      // Format the request data based on the request type
      const formattedRequests = validRequests.map((request) => {
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
          branchName: request.childId.branchId?.branchName || null, // Include branchName
          requestType: request.requestType,
          requestDate: request.requestDate,
          deviceId: request.childId.deviceId,
          formattedRequestDate: request.requestDate
            ? formatDateToDDMMYYYY(new Date(request.requestDate))
            : null,
          schoolName: schoolName, // Include schoolName
        };

        // Add fields conditionally based on the request type
        if (request.requestType === "leave") {
          formattedRequest.startDate = request.startDate || null;
          formattedRequest.endDate = request.endDate || null;
          formattedRequest.newRoute = null; // Ensure newRoute is not included for leave requests
        } else if (request.requestType === "changeRoute") {
          formattedRequest.newRoute = request.newRoute || null;
          formattedRequest.startDate = null; // Ensure startDate and endDate are not included for changeRoute requests
          formattedRequest.endDate = null;
        } else {
          formattedRequest.startDate = null;
          formattedRequest.endDate = null;
          formattedRequest.newRoute = null;
        }

        return formattedRequest;
      });

      // Add the requests data to the requestsBySchool array
      requestsBySchool.push({
        schoolName: schoolName,
        requests: formattedRequests,
      });
    }));

    // Send the response
    res.status(200).json(requestsBySchool);
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Route to get all approved requests for all schools for the superadmin
router.get('/all-approved-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school
    const approvedRequestsBySchool = [];

    // Iterate over each school to fetch approved requests
    await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch approved requests for the current school
      const requests = await Request.find({ statusOfRequest: "approved", schoolId })
        .populate("parentId", "parentName email phone")
        .populate("childId", "childName class branchId") // Populate branchId to get branch details
        .lean();

      // Filter out requests where the parent or child does not exist
      const validRequests = requests.filter(request => request.parentId && request.childId);

      // Format the request data based on the request type
      const formattedRequests = await Promise.all(validRequests.map(async (request) => {
        // Fetch branch details using branchId
        const branch = await Branch.findById(request.childId.branchId).lean();
        const branchName = branch ? branch.branchName : null;

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
          schoolName: schoolName,
          branchName: branchName, // Include branchName
          requestType: request.requestType,
          requestDate: request.requestDate,
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

        return formattedRequest;
      }));

      // Add the requests data to the approvedRequestsBySchool array
      approvedRequestsBySchool.push({
        schoolName: schoolName,
        requests: formattedRequests
      });
    }));

    // Send the response
    res.status(200).json(approvedRequestsBySchool);
  } catch (error) {
    console.error("Error fetching approved requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
// Route to get all denied requests for all schools for the superadmin
router.get('/all-denied-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school
    const deniedRequestsBySchool = [];

    // Iterate over each school to fetch denied requests
    await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch denied requests for the current school
      const deniedRequests = await Request.find({ statusOfRequest: 'denied', schoolId })
        .populate("parentId", "parentName email phone")
        .populate('childId', 'childName deviceId class branchId') // Populate branchId to get branch details
        .lean();

      // Filter out requests where parentId or childId is null or not populated
      const validRequests = deniedRequests.filter(request => request.parentId && request.childId);

      // Format the request data
      const formattedRequests = await Promise.all(validRequests.map(async (request) => {
        // Fetch branch details using branchId
        const branch = await Branch.findById(request.childId.branchId).lean();
        const branchName = branch ? branch.branchName : null;

        return {
          childId: request.childId._id,
          childName: request.childId.childName,
          deviceId: request.childId.deviceId,
          class: request.childId.class,
          statusOfRequest: request.statusOfRequest,
          parentName: request.parentId.parentName,
          email: request.parentId.email,
          phone: request.parentId.phone,
          schoolName: schoolName, // Include schoolName
          branchName: branchName, // Include branchName
          requestDate: request.requestDate,
          formattedRequestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null // Formatted request date
        };
      }));

      // Add the requests data to the deniedRequestsBySchool array
      deniedRequestsBySchool.push({
        schoolName: schoolName,
        requests: formattedRequests
      });
    }));

    // Send the response
    res.status(200).json(deniedRequestsBySchool);
  } catch (error) {
    console.error('Error fetching denied requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all drivers across all schools for the superadmin
router.get('/drivers-by-school', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold driver data by school
    const driversBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch drivers associated with the current school and populate the schoolId and branchId fields
      const drivers = await DriverCollection.find({ schoolId: school._id })
        .populate('schoolId', 'schoolName') // Populate the schoolId field with schoolName
        .populate('branchId', 'branchName') // Populate the branchId field with branchName
        .lean();

      return {
        schoolName: schoolName,
        drivers: drivers.map((driver) => {
          let decryptedPassword;
          try {
            decryptedPassword = decrypt(driver.password);
          } catch (decryptError) {
            decryptedPassword = "Error decrypting password";
          }

          return {
            driverId: driver._id,
            driverName: driver.driverName,
            address: driver.address,
            phone_no: driver.phone_no,
            email: driver.email,
            busName: driver.busName,
            deviceId: driver.deviceId,
            schoolName: driver.schoolId ? driver.schoolId.schoolName : 'N/A', // Access the populated schoolName
            branchName: driver.branchId ? driver.branchId.branchName : 'Branch not found', // Include branchName
            registrationDate: driver.registrationDate,
            formattedRegistrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate)),
            password: decryptedPassword, // Include decrypted password
          };
        }),
      };
    }));

    // Send the response
    res.status(200).json(driversBySchool);
  } catch (error) {
    console.error('Error fetching drivers by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get all supervisors across all schools for the superadmin
router.get('/supervisors-by-school', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold supervisors data by school
    const supervisorsBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch supervisors with populated school and branch data
      const supervisors = await Supervisor.find({ schoolId: school._id })
        .populate('schoolId', 'schoolName') // Populate the schoolId field with schoolName
        .populate('branchId', 'branchName') // Populate the branchId field with branchName
        .lean();

      // Format supervisor data
      const formattedSupervisors = supervisors.map(supervisor => {
        let decryptedPassword;
        try {
          // Decrypt the supervisor's password
          decryptedPassword = decrypt(supervisor.password);
        } catch (decryptError) {
          decryptedPassword = "Error decrypting password";
        }

        // Access branchName correctly
        const branchName = supervisor.branchId ? supervisor.branchId.branchName : 'Branch not found';

        return {
          supervisorId: supervisor._id,
          supervisorName: supervisor.supervisorName,
          address: supervisor.address,
          phone_no: supervisor.phone_no,
          email: supervisor.email,
          branchName: branchName, // Include branchName
          deviceId: supervisor.deviceId,
          schoolName: supervisor.schoolId.schoolName, // Access the populated schoolName
          password: decryptedPassword, // Include decrypted password
          registrationDate: supervisor.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate)), // Format registration date
        };
      });

      return {
        schoolName: schoolName,
        supervisors: formattedSupervisors, // Include the formatted supervisors list
      };
    }));

    // Send the response
    res.status(200).json(supervisorsBySchool);
  } catch (error) {
    // Log and handle any errors
    console.error('Error fetching supervisors by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get data by deviceId for a superadmin
router.get('/read/data-by-deviceId', superadminMiddleware, async (req, res) => {
  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Fetch data for each school
    const dataBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch Supervisor data for the school
      const supervisor = await Supervisor.findOne({ deviceId, schoolId: school._id }).lean();
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
            schoolName: schoolName
          };
        } catch (decryptError) {
          console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
        }
      }

      // Fetch Driver data for the school
      const driver = await DriverCollection.findOne({ deviceId, schoolId: school._id }).lean();
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
            schoolName: schoolName
          };
        } catch (decryptError) {
          console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
        }
      }

      // Fetch Child data for the school
      const children = await Child.find({ deviceId, schoolId: school._id }).lean();
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
            schoolName: schoolName
          };
        })
      );

      return {
        schoolName: schoolName,
        supervisors: [supervisorData],
        drivers: [driverData],
        children: transformedChildren
      };
    }));

    // Send the formatted data by school
    res.status(200).json(dataBySchool);

  } catch (error) {
    console.error('Error fetching data by deviceId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get attendance data for admin dashboard
const convertDate = (dateStr) => {
  const dateParts = dateStr.split('-');
  const jsDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
  return {
    date: dateStr,
    originalDate: jsDate
  };
}
// Pickup and drop status
router.get("/pickup-drop-status", superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Fetch attendance records by school
    const dataBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch attendance records for the current school
      const attendanceRecords = await Attendance.find({ schoolId: school._id })
        .populate({
          path: "childId",
          match: { schoolId: school._id },
          populate: [
            { path: "parentId", select: "phone" }, // Populate parentId to get the parent's phone
            { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
            { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
          ]
        })
        .lean(); // Use lean() to get plain JavaScript objects

      // Filter and map the data for the response
      const childrenData = attendanceRecords
        .filter(record => record.childId && record.childId.parentId)
        .map(record => {
          const { date, originalDate } = convertDate(record.date);

          return {
            _id: record.childId._id,
            childName: record.childId.childName,
            class: record.childId.class,
            rollno: record.childId.rollno,
            section: record.childId.section,
            parentId: record.childId.parentId._id,
            phone: record.childId.parentId.phone,
            branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found", // Include branch name
            schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found", // Include school name
            pickupStatus: record.pickup,
            pickupTime: record.pickupTime,
            deviceId: record.childId.deviceId,
            pickupPoint: record.childId.pickupPoint,
            dropStatus: record.drop,
            dropTime: record.dropTime,
            formattedDate: date,
            date: originalDate
          };
        });

      return {
        schoolName: schoolName,
        children: childrenData
      };
    }));

    // Send the formatted data by school
    res.status(200).json(dataBySchool);

  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get present children for a superadmin
router.get("/present-children", superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Fetch attendance records for children present at pickup by school
    const dataBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch attendance records for the current school where pickup is true
      const attendanceRecords = await Attendance.find({ 
        schoolId: school._id, 
        pickup: true 
      })
        .populate({
          path: "childId",
          match: { schoolId: school._id }, // Ensure that we only get children from the current school
          populate: [
            { path: "parentId", select: "phone" }, // Populate parentId to get parent's phone
            { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
            { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
          ]
        })
        .lean(); // Use lean() to get plain JavaScript objects

      // Filter and map the data for the response
      const childrenData = attendanceRecords
        .filter(record => record.childId && record.childId.parentId)
        .map(record => {
          const { date, originalDate } = convertDate(record.date);

          return {
            _id: record.childId._id,
            childName: record.childId.childName,
            class: record.childId.class,
            rollno: record.childId.rollno,
            section: record.childId.section,
            parentId: record.childId.parentId._id,
            phone: record.childId.parentId.phone,
            branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found", // Include branch name
            schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found", // Include school name
            pickupStatus: record.pickup,
            pickupTime: record.pickupTime,
            deviceId: record.childId.deviceId,
            pickupPoint: record.childId.pickupPoint,
            formattedDate: date,
            date: originalDate
          };
        });

      return {
        schoolName: schoolName,
        children: childrenData
      };
    }));

    // Send the formatted data by school
    res.status(200).json(dataBySchool);

  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get absent children for a superadmin
router.get("/absent-children", superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Fetch attendance records for children absent at pickup by school
    const dataBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch attendance records for the current school where pickup is false
      const attendanceRecords = await Attendance.find({ 
        schoolId: school._id, 
        pickup: false 
      })
        .populate({
          path: "childId",
          match: { schoolId: school._id }, // Ensure that we only get children from the current school
          populate: [
            { path: "parentId", select: "phone" }, // Populate parentId to get parent's phone
            { path: "branchId", select: "branchName" }, // Populate branchId to get the branch name
            { path: "schoolId", select: "schoolName" } // Populate schoolId to get the school name
          ]
        })
        .lean(); // Use lean() to get plain JavaScript objects

      // Filter and map the data for the response
      const childrenData = attendanceRecords
        .filter(record => record.childId && record.childId.parentId)
        .map(record => {
          const { date, originalDate } = convertDate(record.date);

          return {
            _id: record.childId._id,
            childName: record.childId.childName,
            class: record.childId.class,
            rollno: record.childId.rollno,
            section: record.childId.section,
            parentId: record.childId.parentId._id,
            phone: record.childId.parentId.phone,
            branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found", // Include branch name
            schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found", // Include school name
            pickupStatus: record.pickup,
            pickupTime: record.pickupTime,
            deviceId: record.childId.deviceId,
            pickupPoint: record.childId.pickupPoint,
            formattedDate: date,
            date: originalDate
          };
        });

      return {
        schoolName: schoolName,
        children: childrenData
      };
    }));

    // Send the formatted data by school
    res.status(200).json(dataBySchool);

  } catch (error) {
    console.error("Error fetching absent children data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get child status for a superadmin  -- pending want the data schoowise
router.get('/status/:childId', superadminMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    // Find the child and populate related fields
    const child = await Child.findOne({ _id: childId })
      .populate('parentId') // Populate parent details
      .populate('schoolId') // Populate school details
      .populate({
        path: 'branchId', // Populate branch details
        select: 'branchName'
      })
      .lean(); // Convert to plain JavaScript object for easier manipulation

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const parent = child.parentId;
    const school = child.schoolId;

    // Fetch the most recent attendance record for the child
    const attendance = await Attendance.findOne({ childId })
      .sort({ date: -1 })
      .limit(1);

    // Fetch the most recent request for the child
    const request = await Request.findOne({ childId })
      .sort({ requestDate: -1 })
      .limit(1);

    // Fetch the supervisor based on deviceId
    let supervisor = null;
    if (child.deviceId) {
      supervisor = await Supervisor.findOne({ deviceId: child.deviceId });
    }

    // Structure the data by including schoolName and branchName in each student
    const response = {
      schoolName: school ? school.schoolName : 'Unknown School',
      students: [
        {
          childName: child.childName,
          childClass: child.class,
          parentName: parent ? parent.parentName : null,
          parentNumber: parent ? parent.phone : null,
          schoolName: school ? school.schoolName : 'Unknown School', // Include schoolName in each student
          branchName: child.branchId ? child.branchId.branchName : 'Unknown Branch', // Include branchName in each student
          pickupStatus: attendance ? (attendance.pickup ? 'Present' : 'Absent') : null,
          dropStatus: attendance ? (attendance.drop ? 'Present' : 'Absent') : null,
          pickupTime: attendance ? attendance.pickupTime : null,
          dropTime: attendance ? attendance.dropTime : null,
          date: attendance ? attendance.date : null,
          requestType: request ? request.requestType : null,
          startDate: request ? request.startDate || null : null,
          endDate: request ? request.endDate || null : null,
          reason: request ? request.reason || null : null,
          newRoute: request ? request.newRoute || null : null,
          statusOfRequest: request ? request.statusOfRequest || null : null,
          requestDate: request ? formatDateToDDMMYYYY(request.requestDate) : null,
          supervisorName: supervisor ? supervisor.supervisorName : null
        }
      ]
    };

    // Send the response
    res.json(response);
  } catch (error) {
    console.error('Error fetching child status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post("/review-request/:requestId", superadminMiddleware, async (req, res) => {
  try {
    const { statusOfRequest } = req.body;
    const { requestId } = req.params;

    if (!["approved", "denied"].includes(statusOfRequest)) {
      return res.status(400).json({ error: "Invalid statusOfRequest" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Check if the request exists
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
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
});
router.post('/registerStatus/:parentId/', superadminMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { action } = req.body;

    // Find the parent by ID
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
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


router.put('/update-child/:childId', superadminMiddleware, async (req, res) => {
  const { childId } = req.params;
  const { deviceId, ...updateFields } = req.body;

  try {
    // Find the child by ID
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
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
router.put('/update-parent/:id', superadminMiddleware, async (req, res) => {
  const parentId = req.params.id;
  const { parentName, email, password, phone } = req.body;

  try {
    // Find the parent by ID
    const parent = await Parent.findById(parentId);
    
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
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
router.put('/update-driver/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const { deviceId, ...updateFields } = req.body;

    // Find the driver by ID
    const driver = await DriverCollection.findById(driverId);
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
    res.status(200).json({ message: 'Driver information updated successfully', driver: transformedDriver });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.put('/update-supervisor/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const { deviceId, ...updateFields } = req.body;

    // Find the supervisor by ID
    const supervisor = await Supervisor.findById(supervisorId);
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
    res.status(200).json({ message: 'Supervisor information updated successfully', supervisor: transformedSupervisor });
  } catch (error) {
    console.error('Error updating supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// DELETE METHOD
// Delete child
router.delete('/delete/child/:childId', superadminMiddleware, async (req, res) => {
  const { childId } = req.params;

  try {
    // Find the child by ID
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    let parentData = {};
    if (child.parentId) {
      // Find the parent
      const parent = await Parent.findById(child.parentId).lean();
      if (parent) {
        parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id,
        };

        // Check if the parent has any other children
        const childCount = await Child.countDocuments({ parentId: child.parentId });
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
// Delete parent and associated children
router.delete('/delete-parent/:id', superadminMiddleware, async (req, res) => {
  const parentId = req.params.id;

  try {
    // Find the parent by ID
    const parent = await Parent.findById(parentId).lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Delete all children associated with the parent
    await Child.deleteMany({ parentId });

    // Delete the parent
    await Parent.findByIdAndDelete(parentId);

    res.status(200).json({ message: 'Parent and associated children deleted successfully' });
  } catch (error) {
    console.error('Error deleting parent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Delete driver
router.delete('/delete/driver/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;

    // Find and delete the driver by ID
    const deletedDriver = await DriverCollection.findByIdAndDelete(driverId);

    if (!deletedDriver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    console.log('Deleted driver data:', JSON.stringify(deletedDriver, null, 2));
    res.status(200).json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Delete supervisor
router.delete('/delete/supervisor/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id: supervisorId } = req.params;

    // Find and delete the supervisor by ID
    const deletedSupervisor = await Supervisor.findByIdAndDelete(supervisorId);

    if (!deletedSupervisor) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    console.log('Deleted supervisor data:', JSON.stringify(deletedSupervisor, null, 2));
    res.status(200).json({ message: 'Supervisor deleted successfully' });
  } catch (error) {
    console.error('Error deleting supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// school delete
router.delete('/school-delete/:schoolId', superadminMiddleware, async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Find the school by ID
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Delete all branches and related data
    const branches = await Branch.find({ schoolId: school._id });

    for (const branch of branches) {
      const parents = await Parent.find({ schoolId: school._id });

      for (const parent of parents) {
        await Child.deleteMany({ parentId: parent._id });
      }
      await Parent.deleteMany({ schoolId: school._id });
      await Supervisor.deleteMany({ branchId: branch._id });
      await Driver.deleteMany({ branchId: branch._id });
    }

    // Delete all branches
    await Branch.deleteMany({ schoolId: school._id });
    
    // Delete the school
    await school.remove();

    res.status(200).json({ message: 'School, branches, and all related data deleted successfully' });
  } catch (error) {
    console.error('Error during school deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//branch delete
router.delete('/branch-delete/:branchId', superadminMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;

    // Find the branch by ID
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Delete all related data
    const parents = await Parent.find({ branchId: branch._id });

    for (const parent of parents) {
      // Delete children associated with each parent
      await Child.deleteMany({ parentId: parent._id });
    }

    // Delete parents associated with the branch
    await Parent.deleteMany({ branchId: branch._id });

    // Delete supervisors and drivers associated with the branch
    await Supervisor.deleteMany({ branchId: branch._id });
    await Driver.deleteMany({ branchId: branch._id });

    // Finally, delete the branch itself
    await branch.remove();

    res.status(200).json({ message: 'Branch and all related data deleted successfully' });
  } catch (error) {
    console.error('Error during branch deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
