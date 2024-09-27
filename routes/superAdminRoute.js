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
const Geofencing = require("../models/geofence");
const Device = require('../models/device');
const convertDate = (dateStr) => {
  const dateParts = dateStr.split('-');
  const jsDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
  return {
    date: dateStr,
    originalDate: jsDate
  };
}



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
router.post('/school-register', superadminMiddleware, async (req, res) => {
  try {
    const { schoolName, username, password, email, schoolMobile, branchName } = req.body;

    // Check for existing school by username or email
    const existingSchool = await School.findOne({ $or: [{ username }, { email }] });
    if (existingSchool) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Create and save the new School
    const newSchool = new School({
      schoolName,
      username,
      password,
      email,
      schoolMobile
    });

    const savedSchool = await newSchool.save();

    // Create the initial Branch
    const newBranch = new Branch({
      branchName: branchName + "  main-branch",
      schoolId: savedSchool._id, 
      schoolMobile: '', 
      username: '', 
      password: '', 
      email: '' 
    });

    // Save the branch
    const savedBranch = await newBranch.save();

    // Update the School with the branch reference
    savedSchool.branches.push(savedBranch._id);
    await savedSchool.save();

    // Generate a token for the school
    const payload = { id: savedSchool._id, username: savedSchool.username };
    const token = generateToken(payload);

    res.status(201).json({ response: { ...savedSchool.toObject(), password: undefined }, token, role: "schooladmin" });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/add-branch', superadminMiddleware, async (req, res) => {
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

router.get('/getschools', superadminMiddleware, async (req, res) => {
  try {
    const schools = await School.find({})
      .populate({
        path: 'branches',
        select: 'branchName _id username password email',
        populate: {
          path: 'devices',
          select: 'deviceId deviceName'
        }
      })
      .lean();

    const transformedSchools = await Promise.all(schools.map(async (school) => {
      let decryptedSchoolPassword;
      try {
        decryptedSchoolPassword = school.password ? decrypt(school.password) : 'No password';
      } catch (decryptError) {
        console.error(`Error decrypting password for school ${school.schoolName}`, decryptError);
        decryptedSchoolPassword = 'Error decrypting password';
      }
      
      const transformedBranches = school.branches.map(branch => {
        if (!branch.username || !branch.password) {
          return {
            _id: branch._id,
            branchName: branch.branchName,
            devices: branch.devices // Include devices
          };
        } else {
          let decryptedBranchPassword;
          try {
            decryptedBranchPassword = branch.password ? decrypt(branch.password) : 'No password'; 
          } catch (decryptError) {
            console.error(`Error decrypting password for branch ${branch.branchName}`, decryptError);
            decryptedBranchPassword = 'Error decrypting password'; 
          }

          return {
            ...branch,
            password: decryptedBranchPassword,
            devices: branch.devices // Include devices
          };
        }
      });
      
      const branchName = transformedBranches.find(branch => !branch.username || !branch.password)?.branchName || null;
      return {
        ...school,
        password: decryptedSchoolPassword,
        branchName: branchName,
        branches: transformedBranches
      };
    }));
    
    res.status(200).json({ schools: transformedSchools });
  } catch (error) {
    console.error('Error fetching school list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read-devices', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Prepare an array to hold data grouped by school
    const dataBySchool = await Promise.all(
      schools.map(async (school) => {
        const schoolId = school._id;
        const schoolName = school.schoolName;

        // Fetch all branches for the current school
        const branches = await Branch.find({ schoolId: schoolId }).lean();

        // Fetch devices and format the data
        const devicesByBranch = await Promise.all(
          branches.map(async (branch) => {
            const branchId = branch._id;
            const branchName = branch.branchName;

            // Fetch devices associated with the current branch
            const devices = await Device.find({ schoolId: schoolId, branchId: branchId }).lean();

            // Map over devices and return the relevant details
            const rawDevices = devices.map((device) => ({
              actualDeviceId: device._id, // MongoDB's _id for edit/delete operations
              deviceId: device.deviceId,   // Schema deviceId for display
              deviceName: device.deviceName, // Device name as stored in the schema
              registrationDate: device.registrationDate,
            }));

            // Return data grouped by branch
            return {
              branchId: branchId,
              branchName: branchName,
              devices: rawDevices,
            };
          })
        );

        // Return data grouped by school
        return {
          schoolId: schoolId,
          schoolName: schoolName,
          branches: devicesByBranch,
        };
      })
    );

    // Send response in the desired structure
    res.status(200).json({
      data: dataBySchool,
    });
  } catch (error) {
    console.error('Error fetching devices by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read-children', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Prepare an array to hold children data by school
    const childrenBySchool = await Promise.all(schools.map(async (school) => {
      // Fetch all branch data for this school
      const branches = await Branch.find({ schoolId: school._id }).lean();

      // Fetch children and populate parent data
      const children = await Child.find({ schoolId: school._id })
        .populate('parentId', 'parentName email phone password statusOfRegister')
        .lean();

      // Format children data by branch
      const childrenByBranch = await Promise.all(branches.map(async (branch) => {
        const childrenInBranch = await Promise.all(children
          .filter(child => child.branchId?.toString() === branch._id.toString())
          .map(async (child) => {
            // Decrypt parent password
            const parent = await Parent.findById(child.parentId._id).lean();
            const password = parent ? decrypt(parent.password) : '';

            return {
              childId: child._id,
              childName: child.childName,
              class: child.class,
              rollno: child.rollno,
              section: child.section,
              dateOfBirth: child.dateOfBirth,
              childAge: child.childAge,
              pickupPoint: child.pickupPoint,
              deviceName: child.deviceName,
              gender: child.gender,
              parentId: child.parentId._id,
              parentName: child.parentId.parentName,
              email: child.parentId.email,
              phone: child.parentId.phone,
              password, 
              statusOfRegister: child.parentId.statusOfRegister,
              deviceId: child.deviceId,
              registrationDate: child.registrationDate,
              formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
            };
          })
        );

        return {
          branchId: branch._id,
          branchName: branch.branchName,
          children: childrenInBranch,
        };
      }));

      return {
        schoolId: school._id,
        schoolName: school.schoolName,
        branches: childrenByBranch,
      };
    }));

    res.status(200).json({
      data: childrenBySchool,
    });
  } catch (error) {
    console.error('Error fetching children by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read-parents', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold schools data
    const schoolsData = [];

    // Iterate over each school to fetch branches and parents
    await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch branches for the current school
      const branches = await Branch.find({ schoolId }).lean();

      // Initialize an array to hold branch data
      const branchesData = [];

      // Iterate over each branch to fetch parents and children
      await Promise.all(branches.map(async (branch) => {
        const branchId = branch._id;
        const branchName = branch.branchName;

        // Fetch parents for the current branch
        const parents = await Parent.find({ schoolId, branchId })
          .populate('children', '_id childName registrationDate') // Populate childName and registrationDate
          .lean();

        // Transform and aggregate parent data
        const transformedParents = await Promise.all(parents.map(async (parent) => {
          let decryptedPassword;
          try {
            decryptedPassword = decrypt(parent.password); // Decrypt the password
          } catch (decryptError) {
            console.error(`Error decrypting password for parent ${parent.parentName}`, decryptError);
            decryptedPassword = null;
          }

          // Transform children data with formatted registration date
          const transformedChildren = parent.children.map(child => ({
            childId: child._id,
            childName: child.childName,
            registrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
          }));

          return {
            parentId: parent._id,
            parentName: parent.parentName,
            email: parent.email,
            phone: parent.phone,
            password: decryptedPassword, // Decrypted password
            registrationDate: formatDateToDDMMYYYY(new Date(parent.parentRegistrationDate)), // Format parent's registration date
            statusOfRegister: parent.statusOfRegister, // Status of parent registration
            children: transformedChildren,
          };
        }));

        // Add the branch data to the branchesData array
        branchesData.push({
          branchId: branchId,
          branchName: branchName,
          parents: transformedParents
        });
      }));

      // Add the school data to the schoolsData array
      schoolsData.push({
        schoolId: schoolId,
        schoolName: schoolName,
        branches: branchesData
      });
    }));

    // Send the response
    res.status(200).json({
      data: schoolsData
    });
  } catch (error) {
    console.error('Error fetching all parents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/pending-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school and branch
    const requestsBySchool = await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch all branches for the current school
      const branches = await Branch.find({ schoolId: schoolId }).lean();
      
      // Initialize an array to hold the requests grouped by branch
      const requestsByBranch = await Promise.all(branches.map(async (branch) => {
        const branchId = branch._id;
        const branchName = branch.branchName;

        // Fetch pending requests for the current branch
        const requests = await Request.find({
          statusOfRequest: "pending",
          schoolId: schoolId,
          branchId: branchId
        })
          .populate({
            path: "childId",
            select: "childName class deviceId",
          })
          .populate("parentId", "parentName email phone")
          .lean();

        // Filter out requests where the parent or child does not exist
        const validRequests = requests.filter(
          (request) => request.parentId && request.childId
        );

        // Format the request data
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
            requestType: request.requestType,
            deviceId: request.childId.deviceId,
            deviceName: request.childId.deviceName,
            requestDate: request.requestDate
              ? formatDateToDDMMYYYY(new Date(request.requestDate))
              : null,
            // Add schoolName and branchName to each request
            schoolName: schoolName,
            branchName: branchName
          };

          // Add fields conditionally based on the request type
          if (request.requestType === "leave") {
            formattedRequest.startDate = request.startDate
              ? formatDateToDDMMYYYY(new Date(request.startDate))
              : null;
            formattedRequest.endDate = request.endDate
              ? formatDateToDDMMYYYY(new Date(request.endDate))
              : null;
          } else if (request.requestType === "changeRoute") {
            formattedRequest.newRoute = request.newRoute || null;
          }

          return formattedRequest;
        });

        return {
          branchId: branchId,
          branchName: branchName,
          requests: formattedRequests,
        };
      }));

      // Return school data with requests grouped by branch
      return {
        schoolId: schoolId,
        schoolName: schoolName,
        branches: requestsByBranch,
      };
    }));

    // Send the response
    res.status(200).json({
      data: requestsBySchool,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
router.get('/approved-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school and branch
    const approvedRequestsBySchool = await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch all branches for the current school
      const branches = await Branch.find({ schoolId: schoolId }).lean();
      
      // Initialize an array to hold the requests grouped by branch
      const requestsByBranch = await Promise.all(branches.map(async (branch) => {
        const branchId = branch._id;
        const branchName = branch.branchName;

        // Fetch approved requests for the current branch
        const requests = await Request.find({
          statusOfRequest: "approved",
          schoolId: schoolId,
          branchId: branchId
        })
          .populate({
            path: "childId",
            select: "childName class deviceId",
          })
          .populate("parentId", "parentName email phone")
          .lean();

        // Filter out requests where the parent or child does not exist
        const validRequests = requests.filter(
          (request) => request.parentId && request.childId
        );

        // Format the request data
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
            requestType: request.requestType,
            deviceId: request.childId.deviceId,
            deviceName:request.childId.deviceName,
            requestDate: request.requestDate
              ? formatDateToDDMMYYYY(new Date(request.requestDate))
              : null,
            // Add schoolName and branchName to each request
            schoolName: schoolName,
            branchName: branchName
          };

          // Add fields conditionally based on the request type
          if (request.requestType === "leave") {
            formattedRequest.startDate = request.startDate || null;
            formattedRequest.endDate = request.endDate || null;
          } else if (request.requestType === "changeRoute") {
            formattedRequest.newRoute = request.newRoute || null;
          }

          return formattedRequest;
        });

        return {
          branchId: branchId,
          branchName: branchName,
          requests: formattedRequests,
        };
      }));

      // Return school data with requests grouped by branch
      return {
        schoolId: schoolId,
        schoolName: schoolName,
        branches: requestsByBranch,
      };
    }));

    // Send the response
    res.status(200).json({
      data: approvedRequestsBySchool,
    });
  } catch (error) {
    console.error("Error fetching approved requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
router.get('/denied-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold requests data by school and branch
    const deniedRequestsBySchool = await Promise.all(schools.map(async (school) => {
      const schoolId = school._id;
      const schoolName = school.schoolName;

      // Fetch all branches for the current school
      const branches = await Branch.find({ schoolId }).lean();
      
      // Initialize an array to hold the denied requests grouped by branch
      const requestsByBranch = await Promise.all(branches.map(async (branch) => {
        const branchId = branch._id;
        const branchName = branch.branchName;

        // Fetch denied requests for the current branch
        const deniedRequests = await Request.find({
          statusOfRequest: 'denied',
          schoolId: schoolId,
          branchId: branchId
        })
        .populate("parentId", "parentName email phone")
        .populate("childId", "childName deviceId class branchId")
        .lean();

        // Filter out requests where parentId or childId is null or not populated
        const validRequests = deniedRequests.filter(
          (request) => request.parentId && request.childId
        );

        // Format the request data
        const formattedRequests = validRequests.map((request) => ({
          childId: request.childId._id,
          childName: request.childId.childName,
          deviceId: request.childId.deviceId,
          deviceName: request.childId.deviceName,
          class: request.childId.class,
          statusOfRequest: request.statusOfRequest,
          parentName: request.parentId.parentName,
          email: request.parentId.email,
          phone: request.parentId.phone,
          schoolName: schoolName,
          branchName: branchName,
          requestDate: request.requestDate,
          formattedRequestDate: request.requestDate
            ? formatDateToDDMMYYYY(new Date(request.requestDate))
            : null,
        }));

        return {
          branchId: branchId,
          branchName: branchName,
          requests: formattedRequests,
        };
      }));

      // Return school data with requests grouped by branch
      return {
        schoolId: schoolId,
        schoolName: schoolName,
        branches: requestsByBranch,
      };
    }));

    // Send the response
    res.status(200).json({
      data: deniedRequestsBySchool,
    });
  } catch (error) {
    console.error('Error fetching denied requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read-drivers', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Prepare an array to hold drivers data by school
    const driversBySchool = await Promise.all(schools.map(async (school) => {
      // Fetch all branches for the current school
      const branches = await Branch.find({ schoolId: school._id }).lean();

      // Fetch drivers and format the data
      const driversByBranch = await Promise.all(
        branches.map(async (branch) => {
          // Fetch drivers associated with the current branch
          const drivers = await DriverCollection.find({
            schoolId: school._id,
            branchId: branch._id,
          })
            .populate('schoolId', 'schoolName')
            .populate('branchId', 'branchName')
            .lean();

          // Format driver data
          const formattedDrivers = drivers.map((driver) => {
            let decryptedPassword;
            try {
              decryptedPassword = decrypt(driver.password);
            } catch (decryptError) {
              decryptedPassword = 'Error decrypting password';
            }

            return {
              driverId: driver._id,
              driverName: driver.driverName,
              address: driver.address,
              driverMobile: driver.driverMobile,
              email: driver.email,
              deviceName: driver.deviceName,
              deviceId: driver.deviceId,
              statusOfRegister:driver.statusOfRegister,
              schoolName: driver.schoolId ? driver.schoolId.schoolName : 'N/A', // Access the populated schoolName
              branchName: driver.branchId ? driver.branchId.branchName : 'Branch not found', // Include branchName
              registrationDate: driver.registrationDate,
              formattedRegistrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate)),
              password: decryptedPassword, // Include decrypted password
            };
          });

          // Return data grouped by branch
          return {
            branchId: branch._id,
            branchName: branch.branchName,
            drivers: formattedDrivers,
          };
        })
      );

      // Return data grouped by school
      return {
        schoolId: school._id,
        schoolName: school.schoolName,
        branches: driversByBranch,
      };
    }));

    // Send response
    res.status(200).json({
      data: driversBySchool,
    });
  } catch (error) {
    console.error('Error fetching drivers by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/read-supervisors', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Prepare an array to hold supervisors data by school
    const supervisorsBySchool = await Promise.all(
      schools.map(async (school) => {
        const schoolId = school._id;
        const schoolName = school.schoolName;

        // Fetch all branches for the current school
        const branches = await Branch.find({ schoolId: schoolId }).lean();

        // Fetch supervisors and format the data
        const supervisorsByBranch = await Promise.all(
          branches.map(async (branch) => {
            const branchId = branch._id;
            const branchName = branch.branchName;

            // Fetch supervisors associated with the current branch
            const supervisors = await Supervisor.find({
              schoolId: schoolId,
              branchId: branchId,
            })
              .populate('schoolId', 'schoolName')
              .populate('branchId', 'branchName')
              .lean();

            // Format supervisor data
            const formattedSupervisors = supervisors.map((supervisor) => {
              let decryptedPassword;
              try {
                decryptedPassword = decrypt(supervisor.password);
              } catch (decryptError) {
                decryptedPassword = 'Error decrypting password';
              }

              return {
                supervisorId: supervisor._id,
                supervisorName: supervisor.supervisorName,
                address: supervisor.address,
                phone_no: supervisor.phone_no,
                email: supervisor.email,
                deviceId: supervisor.deviceId,
                statusOfRegister:supervisor.statusOfRegister,
                deviceName:supervisor.deviceName,
                schoolName: supervisor.schoolId ? supervisor.schoolId.schoolName : 'N/A', // Access the populated schoolName
                branchName: supervisor.branchId ? supervisor.branchId.branchName : 'Branch not found', // Include branchName
                registrationDate: supervisor.registrationDate,
                formattedRegistrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate)),
                password: decryptedPassword, // Include decrypted password
              };
            });

            // Return data grouped by branch
            return {
              branchId: branchId,
              branchName: branchName,
              supervisors: formattedSupervisors,
            };
          })
        );

        // Return data grouped by school
        return {
          schoolId: schoolId,
          schoolName: schoolName,
          branches: supervisorsByBranch,
        };
      })
    );

    // Send response in the desired structure
    res.status(200).json({
      data: supervisorsBySchool,
    });
  } catch (error) {
    console.error('Error fetching supervisors by school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get("/pickup-drop-status",superadminMiddleware, async (req, res) => {
  try {
    const schools = await School.find({}).lean();

    const dataBySchool = await Promise.all(
      schools.map(async (school) => {
        const schoolId = school._id.toString();
        const schoolName = school.schoolName;

        const branches = await Branch.find({ schoolId }).lean();

        const dataByBranch = await Promise.all(
          branches.map(async (branch) => {
            const branchId = branch._id.toString();
            const branchName = branch.branchName;

            const attendanceRecords = await Attendance.find({ schoolId, branchId })
              .populate({
                path: "childId",
                match: { schoolId, branchId },
                populate: [
                  { path: "parentId", select: "phone name email" },
                  { path: "branchId", select: "branchName" },
                  { path: "schoolId", select: "schoolName" },
                ],
              })
              .lean();

            const childrenData = attendanceRecords
              .filter(record => record.childId && record.childId.parentId).map(record => {
                return {
                  childId: record.childId._id.toString(),
                  childName: record.childId.childName,
                  class: record.childId.class,
                  rollno: record.childId.rollno,
                  section: record.childId.section,
                  dateOfBirth: record.childId.dateOfBirth,
                  childAge: record.childId.childAge,
                  pickupPoint: record.childId.pickupPoint,
                  deviceName: record.childId.deviceName,
                  gender: record.childId.gender,
                  parentId: record.childId.parentId._id.toString(),
                  parentName: record.childId.parentId.name,
                  email: record.childId.parentId.email,
                  phone: record.childId.parentId.phone,
                  statusOfRegister: record.childId.statusOfRegister,
                  deviceId: record.childId.deviceId,
                  date:record.date,
                  pickupStatus: record.pickup,
                  pickupTime: record.pickupTime,
                  dropStatus: record.drop,
                  dropTime: record.dropTime,
                };
              });

            return {
              branchId: branchId,
              branchName: branchName,
              children: childrenData,
            };
          })
        );

        return {
          schoolId: schoolId,
          schoolName: schoolName,
          branches: dataByBranch,
        };
      })
    );

    res.status(200).json({ data: dataBySchool });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/present-children", superadminMiddleware, async (req, res) => {
  try {
    const schools = await School.find({}).lean();

    const dataBySchool = await Promise.all(
      schools.map(async (school) => {
        const schoolId = school._id.toString();
        const schoolName = school.schoolName;

        const branches = await Branch.find({ schoolId }).lean();

        const dataByBranch = await Promise.all(
          branches.map(async (branch) => {
            const branchId = branch._id.toString();
            const branchName = branch.branchName;

            const attendanceRecords = await Attendance.find({ schoolId, branchId, pickup: true })
              .populate({
                path: "childId",
                match: { schoolId, branchId },
                populate: [
                  { path: "parentId", select: "phone name email" },
                  { path: "branchId", select: "branchName" },
                  { path: "schoolId", select: "schoolName" },
                ],
              })
              .lean();

            const childrenData = attendanceRecords
              .filter(record => record.childId && record.childId.parentId)
              .map(record => {
                const { date, originalDate } = convertDate(record.date);

                return {
                  childId: record.childId._id.toString(),
                  childName: record.childId.childName,
                  class: record.childId.class,
                  rollno: record.childId.rollno,
                  section: record.childId.section,
                  dateOfBirth: record.childId.dateOfBirth,
                  childAge: record.childId.childAge,
                  pickupPoint: record.childId.pickupPoint,
                  deviceName: record.childId.deviceName,
                  gender: record.childId.gender,
                  parentId: record.childId.parentId._id.toString(),
                  parentName: record.childId.parentId.name,
                  email: record.childId.parentId.email,
                  phone: record.childId.parentId.phone,
                  statusOfRegister: record.childId.statusOfRegister,
                  deviceId: record.childId.deviceId,
                  date:record.date,
                  pickupStatus: record.pickup,
                  pickupTime: record.pickupTime,
                };
              });

            return {
              branchId: branchId,
              branchName: branchName,
              children: childrenData,
            };
          })
        );

        return {
          schoolId: schoolId,
          schoolName: schoolName,
          branches: dataByBranch,
        };
      })
    );

    res.status(200).json({ data: dataBySchool });
  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/absent-children", superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Fetch attendance records for children absent at pickup by school
    const dataBySchool = await Promise.all(schools.map(async (school) => {
      const schoolId = school._id.toString();
      const schoolName = school.schoolName;

      // Fetch branches for the current school
      const branches = await Branch.find({ schoolId }).lean();

      const dataByBranch = await Promise.all(branches.map(async (branch) => {
        const branchId = branch._id.toString();
        const branchName = branch.branchName;

        // Fetch attendance records for the current branch where pickup is false
        const attendanceRecords = await Attendance.find({
          schoolId,
          branchId,
          pickup: false
        })
          .populate({
            path: "childId",
            match: { schoolId, branchId },
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
              _id: record.childId._id.toString(),
              childName: record.childId.childName,
              class: record.childId.class,
              rollno: record.childId.rollno,
              section: record.childId.section,
              parentId: record.childId.parentId._id.toString(),
              phone: record.childId.parentId.phone,
              branchName: record.childId.branchId ? record.childId.branchId.branchName : "Branch not found", // Include branch name
              schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : "School not found", // Include school name
              pickupStatus: record.pickup,
              pickupTime: record.pickupTime,
              deviceId: record.childId.deviceId,
              deviceName: record.childId.deviceName,
              pickupPoint: record.childId.pickupPoint,
              date:record.date
            };
          });

        return {
          branchId: branchId,
          branchName: branchName,
          children: childrenData
        };
      }));

      return {
        schoolId: schoolId,
        schoolName: schoolName,
        branches: dataByBranch
      };
    }));

    // Send the formatted data by school
    res.status(200).json({ data: dataBySchool });

  } catch (error) {
    console.error("Error fetching absent children data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get('/status-of-children', superadminMiddleware, async (req, res) => {
  try {
    const children = await Child.find({})
      .populate('parentId')
      .populate('schoolId')
      .populate({
        path: 'branchId',
        select: 'branchName'
      })
      .lean();

    if (!children || children.length === 0) {
      return res.status(404).json({ message: 'No children found in any school or branch' });
    }

    const schoolBranchData = {};

    for (const child of children) {
      const school = child.schoolId;
      const branch = child.branchId;
      const parent = child.parentId;
      const password = parent ? decrypt(parent.password) : 'Unknown Password';

      const attendance = await Attendance.findOne({ childId: child._id })
        .sort({ date: -1 })
        .limit(1)
        .lean();

      const request = await Request.findOne({ childId: child._id })
        .sort({ requestDate: -1 })
        .limit(1)
        .lean();

      let supervisor = null;
      if (child.deviceId) {
        supervisor = await Supervisor.findOne({ deviceId: child.deviceId }).lean();
      }

      if (attendance || request) {
        const childData = {
          childId: child._id,
          childName: child.childName,
          childClass: child.class,
          childAge: child.childAge,
          section: child.section,
          rollno: child.rollno,
          deviceId: child.deviceId,
          deviceName:child.deviceName,
          gender: child.gender,
          pickupPoint: child.pickupPoint,
          parentName: parent ? parent.parentName : 'Unknown Parent',
          parentNumber: parent ? parent.phone : 'Unknown Phone',
          email: parent ? parent.email : 'Unknown email',
          password: password,
          ...(attendance && {
            pickupStatus: attendance.pickup ? 'Present' : 'Absent',
            dropStatus: attendance.drop ? 'Present' : 'Absent',
            pickupTime: attendance.pickupTime,
            dropTime: attendance.dropTime,
            date: attendance.date
          }),
          ...(request && {
            requestType: request.requestType,
            startDate: request.startDate ? formatDateToDDMMYYYY(request.startDate) : 'N/A',
            endDate: request.endDate ? formatDateToDDMMYYYY(request.endDate) : 'N/A',
            reason: request.reason,
            newRoute: request.newRoute,
            statusOfRequest: request.statusOfRequest,
            requestDate: request.requestDate ? formatDateToDDMMYYYY(request.requestDate) : 'N/A'
          }),
          ...(supervisor && {
            supervisorName: supervisor.supervisorName
          })
        };

        if (!schoolBranchData[school._id]) {
          schoolBranchData[school._id] = {
            schoolId: school._id.toString(),
            schoolName: school.schoolName,
            branches: {}
          };
        }

        if (!schoolBranchData[school._id].branches[branch._id]) {
          schoolBranchData[school._id].branches[branch._id] = {
            branchId: branch._id.toString(),
            branchName: branch.branchName,
            children: []
          };
        }

        schoolBranchData[school._id].branches[branch._id].children.push(childData);
      }
    }

    const responseData = Object.values(schoolBranchData).map(school => ({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      branches: Object.values(school.branches).map(branch => ({
        branchId: branch.branchId,
        branchName: branch.branchName,
        children: branch.children
      }))
    }));

    res.json({ data: responseData });
  } catch (error) {
    console.error('Error fetching children status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/status/:childId', superadminMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    // Find the child and populate branch, parent, and school details
    const child = await Child.findOne({ _id: childId })
      .populate({
        path: 'parentId',
        select: 'parentName phone password email'
      })
      .populate({
        path: 'branchId', // Populate branchId field
        select: 'branchName'
      })
      .populate({
        path: 'schoolId', // Populate schoolId field
        select: 'schoolName'
      })
      .lean(); // Convert to plain JavaScript object

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const parent = child.parentId;
    const branch = child.branchId;
    const school = child.schoolId;
    const password = parent && parent.password ? decrypt(parent.password) : 'Unknown Password';
    // Fetch the most recent attendance record for the child
    const attendance = await Attendance.findOne({ childId })
      .sort({ date: -1 })
      .limit(1);

    // Fetch the most recent request for the child
    const request = await Request.findOne({ childId })
      .sort({ requestDate: -1 })
      .limit(1);

    // Fetch the supervisor based on deviceId and schoolId
    let supervisor = null;
    if (child.deviceId) {
      supervisor = await Supervisor.findOne({ deviceId: child.deviceId, schoolId: child.schoolId });
    }

    // Construct the response object only with fields that have data
    const response = {};

    if (child.childName) response.childName = child.childName;
    if (child.class) response.childClass = child.class;
    if (child.rollno) response.rollno = child.rollno;
    if (child.deviceId) response.deviceId = child.deviceId;
    if (child.deviceName) response.deviceName = child.deviceName;
    if (child.gender) response.gender = child.gender;
    if (child.pickupPoint) response.pickupPoint = child.pickupPoint;
    if (parent && parent.parentName) response.parentName = parent.parentName;
    if (parent && parent.phone) response.parentNumber = parent.phone;
    if (parent && parent.email) response.email = parent.email;
    if (password) response.password = password; 
    if (branch && branch.branchName) response.branchName = branch.branchName;
    if (school && school.schoolName) response.schoolName = school.schoolName;
    if (attendance && attendance.pickup !== undefined) response.pickupStatus = attendance.pickup ? 'Present' : 'Absent';
    if (attendance && attendance.drop !== undefined) response.dropStatus = attendance.drop ? 'Present' : 'Absent';
    if (attendance && attendance.pickupTime) response.pickupTime = attendance.pickupTime;
    if (attendance && attendance.dropTime) response.dropTime = attendance.dropTime;
    if (attendance && attendance.date) response.date = attendance.date;
    if (request && request.requestType) response.requestType = request.requestType;

    // Format startDate, endDate, and requestDate to 'dd-mm-yyyy'
    if (request && request.startDate) response.startDate = formatDateToDDMMYYYY(request.startDate);
    if (request && request.endDate) response.endDate = formatDateToDDMMYYYY(request.endDate);
    if (request && request.requestDate) response.requestDate = formatDateToDDMMYYYY(request.requestDate);

    if (request && request.reason) response.reason = request.reason;
    if (request && request.newRoute) response.newRoute = request.newRoute;
    if (request && request.statusOfRequest) response.statusOfRequest = request.statusOfRequest;
    if (supervisor && supervisor.supervisorName) response.supervisorName = supervisor.supervisorName;

    // Send the filtered response
    res.json({child:response});
  } catch (error) {
    console.error('Error fetching child status:', error);
    res.status(500).json({ message: 'Server error' });
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



// POST METHOD
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
router.post('/registerStatus/:parentId', superadminMiddleware, async (req, res) => {
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
router.post('/registerStatus-driver/:driverId', superadminMiddleware, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { action } = req.body;

    // Find the driver by ID
    const driver = await DriverCollection.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'driver not found' });
    }

    // Update the registration status based on the action
    if (action === 'approve') {
      driver.statusOfRegister = 'approved';
    } else if (action === 'reject') {
      driver.statusOfRegister = 'rejected';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    await driver.save();

    res.status(200).json({ message: `Registration ${action}d successfully.` });
  } catch (error) {
    console.error('Error during registration status update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/registerStatus-supervisor/:supervisorId', superadminMiddleware, async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const { action } = req.body;

    // Find the supervisor by ID
    const supervisor = await Supervisor.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({ error: 'supervisor not found' });
    }

    // Update the registration status based on the action
    if (action === 'approve') {
      supervisor.statusOfRegister = 'approved';
    } else if (action === 'reject') {
      supervisor.statusOfRegister = 'rejected';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    await supervisor.save();

    res.status(200).json({ message: `Registration ${action}d successfully.` });
  } catch (error) {
    console.error('Error during registration status update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/add-device', superadminMiddleware, async (req, res) => {
  try {
    const { deviceId, deviceName, schoolName, branchName } = req.body;

    // Validate the required fields
    if (!deviceId || !deviceName || !schoolName || !branchName) {
      return res.status(400).json({ message: 'All fields (deviceId, deviceName, schoolName, branchName) are required' });
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

    // Check if a device with the same ID already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ message: 'Device with this ID already exists' });
    }

    // Create a new device linked to the school and branch
    const newDevice = new Device({
      deviceId,
      deviceName,
      schoolId: school._id,  // Link to the school's ID
      branchId: branch._id   // Link to the branch's ID
    });

    // Save the device
    await newDevice.save();

    // Update the branch to include the new device
    branch.devices.push(newDevice._id);
    await branch.save();

    // Return success response
    res.status(201).json({ message: 'Device created successfully', device: newDevice });
  } catch (error) {
    console.error('Error adding device:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




// EDIT METHOD
router.put('/edit-device/:actualDeviceId', superadminMiddleware, async (req, res) => {
  try {
    const { actualDeviceId } = req.params; // The MongoDB _id of the device from the URL
    const { deviceId, deviceName, branchName, schoolName } = req.body; // The new values from the request body

    // Validate that required fields are provided
    if (!deviceId || !deviceName || !branchName || !schoolName) {
      return res.status(400).json({ message: 'deviceId, deviceName, branchName, and schoolName are required' });
    }

    // Check if the manually added deviceId already exists in another device
    const existingDevice = await Device.findOne({
      deviceId,
      _id: { $ne: actualDeviceId } // Exclude the current device from this check
    });

    if (existingDevice) {
      return res.status(400).json({ message: 'Device with this manually added deviceId already exists' });
    }

    // Find and update the device
    const updatedDevice = await Device.findByIdAndUpdate(
      actualDeviceId,
      {
        deviceId, // Manually added deviceId
        deviceName,
        branchName, // Manually provided branch name
        schoolName  // Manually provided school name
      },
      { new: true } // Return the updated document
    );

    if (!updatedDevice) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Find the school and branch where this device should be updated
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found in the specified school' });
    }

    // Update the branch to include the updated device (if necessary)
    if (!branch.devices.includes(updatedDevice._id)) {
      branch.devices.push(updatedDevice._id);
      await branch.save();
    }

    // Return success response with the updated device data
    res.status(200).json({ message: 'Device updated successfully', device: updatedDevice });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ message: 'Internal server error' });
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
router.put('/edit-school/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolName, username, password, email, schoolMobile } = req.body;

    // Check if a school with the new username or email already exists (but not the current school)
    const existingSchool = await School.findOne({
      _id: { $ne: id }, 
      $or: [{ username }, { email }]
    });
    
    if (existingSchool) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Find the school by ID and update the details
    const updatedSchool = await School.findByIdAndUpdate(
      id,
      {
        schoolName,
        username,
        password,
        email,
        schoolMobile
      },
      { new: true, runValidators: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Generate a new token if the username has changed (optional, based on your app logic)
    const payload = { id: updatedSchool._id, username: updatedSchool.username };
    const token = generateToken(payload);

    // Respond with the updated school details and token
    res.status(200).json({ response: { ...updatedSchool.toObject(), password: undefined }, token, role: "schooladmin" });
  } catch (error) {
    console.error('Error during school update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.put('/edit-branch/:id', superadminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { branchName, email, schoolMobile, username, password } = req.body;

    // Find the branch by ID
    const existingBranch = await Branch.findById(id);
    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Check if the username is already taken by another branch
    const duplicateUsernameBranch = await Branch.findOne({
      _id: { $ne: id }, 
      username 
    });
    
    if (duplicateUsernameBranch) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different one.' });
    }

    // Update the branch details
    const updatedBranch = await Branch.findByIdAndUpdate(
      id,
      {
        branchName,
        email,
        schoolMobile,
        username,
        password
      },
      { new: true, runValidators: true }
    );

    if (!updatedBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.status(200).json({ branch: updatedBranch });
  } catch (error) {
    console.error('Error editing branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// DELETE METHOD
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
router.delete('/delete-driver/:id', superadminMiddleware, async (req, res) => {
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
router.delete('/delete-supervisor/:id', superadminMiddleware, async (req, res) => {
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
router.delete('/delete-school/:id', superadminMiddleware, async (req, res) => {
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
      await DriverCollection.deleteMany({ branchId: branch._id });
    }

    // Delete all branches associated with the school
    await Branch.deleteMany({ schoolId: school._id });
    
    // Delete the school using deleteOne()
    await School.deleteOne({ _id: schoolId });

    res.status(200).json({ message: 'School, branches, and all related data deleted successfully' });
  } catch (error) {
    console.error('Error during school deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.delete('/delete-branch/:id', superadminMiddleware, async (req, res) => {
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
    await DriverCollection.deleteMany({ branchId: branch._id });

    // Delete the branch itself using deleteOne()
    await Branch.deleteOne({ _id: branchId });

    res.status(200).json({ message: 'Branch and all related data deleted successfully' });
  } catch (error) {
    console.error('Error during branch deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.delete('/delete-device/:actualDeviceId', superadminMiddleware, async (req, res) => {
  try {
    const { actualDeviceId } = req.params;

    // Find the device by actualDeviceId (which is the MongoDB _id)
    const device = await Device.findById(actualDeviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Delete the device by actualDeviceId (MongoDB _id)
    await Device.deleteOne({ _id: actualDeviceId });

    // Return success response
    res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;
