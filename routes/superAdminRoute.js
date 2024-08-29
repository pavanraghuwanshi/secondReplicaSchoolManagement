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
  const { email, password } = req.body;
  try {
    const superadmin = await Superadmin.findOne({ email });
    if (!superadmin) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await superadmin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({ id: superadmin._id, email: superadmin.email });
    res.status(200).json({ success: true, message: "Login successful", token ,role: 'superadmin'});
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// School Registration Route
router.post('/school-register', superadminMiddleware, async (req, res) => {
  const { schoolName, username, password, email, mobileNo, branch } = req.body;
  try {
    const existingSchool = await School.findOne({ $or: [{ username }, { email }] });
    if (existingSchool) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const newSchool = new School({
      schoolName,
      username,
      password,
      email,
      mobileNo,
      branch
    });
    const savedSchool = await newSchool.save();

    const payload = { id: savedSchool._id, email: savedSchool.email };
    const token = generateToken(payload);

    res.status(201).json({ response: { ...savedSchool.toObject(), password: undefined }, token, role: "schooladmin" });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all children grouped by school for the superadmin
router.get('/children-by-school', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all schools
    const schools = await School.find({}).lean();

    // Initialize an empty array to hold children data by school
    const childrenBySchool = await Promise.all(schools.map(async (school) => {
      const schoolName = school.schoolName;

      // Fetch children with populated parent data
      const children = await Child.find({ schoolId: school._id })
        .populate('parentId', 'parentName email phone password')
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
            password: decryptedPassword, // Include decrypted password
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

router.get('/getschools',superadminMiddleware, async (req, res) => {
  try {
    // Fetch specific fields from the School collection
    const schools = await School.find({}, 'schoolName username email mobileNo branch');
    res.status(200).json({ schools });
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
    // Fetch all pending requests across all schools
    const requests = await Request.find({ statusOfRequest: "pending" })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName class")
      .lean();

    // Filter out requests where the parent or child does not exist
    const validRequests = requests.filter(request => request.parentId && request.childId);

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
    });

    // Send the formatted requests as a JSON response
    res.status(200).json({
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Route to get all approved requests for all schools for the superadmin
router.get('/all-approved-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all approved requests across all schools
    const requests = await Request.find({ statusOfRequest: "approved" })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName class")
      .lean();

    // Filter out requests where the parent or child does not exist
    const validRequests = requests.filter(request => request.parentId && request.childId);

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
    });

    // Send the formatted requests as a JSON response
    res.status(200).json({
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
// Route to get all denied requests for all schools for the superadmin
router.get('/all-denied-requests', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all denied requests across all schools
    const deniedRequests = await Request.find({ statusOfRequest: 'denied' })
      .populate("parentId", "parentName email phone")
      .populate('childId', 'childName deviceId class')
      .lean();

    // Filter out requests where parentId or childId is null or not populated
    const validRequests = deniedRequests.filter(request => request.parentId && request.childId);

    const formattedRequests = validRequests.map(request => ({
      childId: request.childId._id,
      childName: request.childId.childName,
      deviceId: request.childId.deviceId,
      class: request.childId.class,
      statusOfRequest: request.statusOfRequest,
      parentName: request.parentId.parentName,
      email: request.parentId.email,
      phone: request.parentId.phone,
      requestDate: request.requestDate,
      formattedRequestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null // Formatted request date
    }));

    // Send the formatted requests as a JSON response
    res.status(200).json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error fetching denied requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get all drivers across all schools for the superadmin
router.get('/all-drivers', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all drivers across all schools
    const drivers = await DriverCollection.find()
      .populate('schoolId', 'schoolName') // Include the school name

    const driverData = drivers.map(driver => {
      try {
        console.log(`Decrypting password for driver: ${driver.driverName}, encryptedPassword: ${driver.password}`);
        const decryptedPassword = decrypt(driver.password);
        return {
          id: driver._id,
          driverName: driver.driverName,
          address: driver.address,
          phone_no: driver.phone_no,
          email: driver.email,
          deviceId: driver.deviceId,
          password: decryptedPassword,
          registrationDate: driver.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate)),
          schoolName: driver.schoolId.schoolName, // Include the school name
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
        return null;
      }
    }).filter(driver => driver !== null);

    // Send the formatted driver data as a JSON response
    res.status(200).json({ drivers: driverData });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to get all supervisors across all schools for the superadmin
router.get('/all-supervisors', superadminMiddleware, async (req, res) => {
  try {
    // Fetch all supervisors across all schools
    const supervisors = await Supervisor.find()
      .populate('schoolId', 'schoolName'); // Include the school name

    const supervisorData = supervisors.map(supervisor => {
      try {
        console.log(`Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`);
        const decryptedPassword = decrypt(supervisor.password);
        return {
          id: supervisor._id,
          supervisorName: supervisor.supervisorName,
          address: supervisor.address,
          phone_no: supervisor.phone_no,
          email: supervisor.email,
          deviceId: supervisor.deviceId,
          password: decryptedPassword,
          registrationDate: supervisor.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate)),
          schoolName: supervisor.schoolId.schoolName, // Include the school name
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
        return null;
      }
    }).filter(supervisor => supervisor !== null);

    // Send the formatted supervisor data as a JSON response
    res.status(200).json({ supervisors: supervisorData });
  } catch (error) {
    console.error('Error fetching supervisors:', error);
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
    // Fetch Supervisor data across all schools
    const supervisor = await Supervisor.findOne({ deviceId }).lean();
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
          schoolName: supervisor.schoolId ? supervisor.schoolId.schoolName : null // Assuming schoolId is populated
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
      }
    }

    // Fetch Driver data across all schools
    const driver = await DriverCollection.findOne({ deviceId }).lean();
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
          schoolName: driver.schoolId ? driver.schoolId.schoolName : null // Assuming schoolId is populated
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
      }
    }

    // Fetch Child data across all schools
    const children = await Child.find({ deviceId }).lean();
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
          schoolName: child.schoolId ? child.schoolId.schoolName : null // Assuming schoolId is populated
        };
      })
    );

    // Combine results into desired structure
    const responseData = {
      deviceId: deviceId,
      data: {
        childData: transformedChildren,
        driverData: driverData,
        supervisorData: supervisorData
      }
    };

    res.status(200).json(responseData);

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
    // Fetch attendance records across all schools if superadmin
    const attendanceRecords = await Attendance.find({})
      .populate({
        path: "childId",
        populate: {
          path: "parentId"
        }
      })
      .lean();

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

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get present children for a superadmin
router.get("/present-children", superadminMiddleware, async (req, res) => {
  try {
    // Fetch attendance records for children present at pickup across all schools
    const attendanceRecords = await Attendance.find({ pickup: true })
      .populate({
        path: "childId",
        populate: {
          path: "parentId"
        }
      })
      .lean();

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
          pickupStatus: record.pickup,
          pickupTime: record.pickupTime,
          deviceId: record.childId.deviceId,
          pickupPoint: record.childId.pickupPoint,
          formattedDate: date,
          date: originalDate
        };
      });

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get absent children for a superadmin
router.get("/absent-children", superadminMiddleware, async (req, res) => {
  try {
    // Fetch attendance records for children absent at pickup across all schools
    const attendanceRecords = await Attendance.find({ pickup: false })
      .populate({
        path: "childId",
        populate: {
          path: "parentId"
        }
      })
      .lean();

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
          pickupStatus: record.pickup,
          pickupTime: record.pickupTime,
          deviceId: record.childId.deviceId,
          pickupPoint: record.childId.pickupPoint,
          formattedDate: date,
          date: originalDate
        };
      });

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching absent children data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get child status for a superadmin
router.get('/status/:childId', superadminMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    // Find the child across all schools
    const child = await Child.findOne({ _id: childId }).populate('parentId');
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const parent = child.parentId;

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

    // Construct the response object
    const response = {
      childName: child.childName,
      childClass: child.class,
      parentName: parent.parentName,
      parentNumber: parent.phone,
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
      statusOfRequest: request ? request.statusOfRequest : null,
      requestDate: request ? formatDateToDDMMYYYY(request.requestDate) : null,
      supervisorName: supervisor ? supervisor.supervisorName : null
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
// Delete parent
router.delete('/delete-parent/:id', superadminMiddleware, async (req, res) => {
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
// DELETE METHOD
// Delete driver
router.delete('/delete/driver/:id', superadminMiddleware, async (req, res) => {
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

// Delete supervisor
router.delete('/delete/supervisor/:id', superadminMiddleware, async (req, res) => {
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



module.exports = router;
