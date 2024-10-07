const express = require("express");
const router = express.Router();
const Child = require("../models/child");
const Parent = require("../models/Parent");
const { branchAuthMiddleware,generateToken } = require("../jwt");
const Branch = require("../models/branch");
const DriverCollection = require('../models/driver');
const Supervisor = require("../models/supervisor");
const Attendance = require("../models/attendence");
const Request = require("../models/request");
const { decrypt } = require('../models/cryptoUtils');
const { formatDateToDDMMYYYY } = require('../utils/dateUtils');
const School = require("../models/school");
const Geofencing = require("../models/geofence");
const Device = require('../models/device');
const convertDate = (dateStr) => {
  const dateParts = dateStr.split("-");
  const jsDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
  return {
    date: dateStr,
    originalDate: jsDate,
  };
};

// Login route for branches
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const branch = await Branch.findOne({ username }).populate('schoolId');
    if (!branch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const isMatch = await branch.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const schoolName = branch.schoolId.schoolName;
    const branchName = branch.branchName;
    const token = generateToken({
      id: branch._id,
      username: branch.username,
      role: "branch",
      schoolName: schoolName,
      branchName: branchName,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      role: "branch",
      schoolName,
      branchName
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// GET METHOD
router.get('/read-devices', branchAuthMiddleware, async (req, res) => {
  const { branchId } = req;
  try {
    const branch = await Branch.findById(branchId).populate('schoolId', 'schoolName').lean();
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    const schoolName = branch.schoolId.schoolName;
    const devices = await Device.find({ branchId }).lean();
    const formattedDevices = devices.map((device) => ({
      deviceId: device.deviceId, 
      actualDeviceId: device._id, 
      deviceName: device.deviceName
    }));
    const responseData = {
      schoolName: schoolName,
      branchName: branch.branchName, 
      devices: formattedDevices, 
    };
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching devices by branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get("/read-children", branchAuthMiddleware, async (req, res) => {
  try {
    const { branchId } = req;
    const branch = await Branch.findById(branchId).lean();
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    const school = await School.findById(branch.schoolId).lean();
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }
    const children = await Child.find({ branchId }).lean();
    const transformedChildren = await Promise.all(
      children.map(async (child) => {
        const parent = await Parent.findById(child.parentId).lean();
        if (!parent) {
          return null; 
        }

        let decryptedPassword;
        try {
          decryptedPassword = decrypt(parent.password); 
        } catch (error) {
          decryptedPassword = "Error decrypting password";
        }
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
          deviceId: child.deviceId,
          registrationDate: child.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
          parentId: parent._id,
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          statusOfRegister: parent.statusOfRegister,
          password: decryptedPassword,
          schoolName: school.schoolName, 
          branchName: branch.branchName  
        };
      })
    );
    const filteredChildren = transformedChildren.filter(child => child !== null);
    res.status(200).json({
      data: filteredChildren
    });
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/read-parents", branchAuthMiddleware, async (req, res) => {
  try {
    const { branchId } = req;
    const branch = await Branch.findById(branchId).lean();
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    const branchName = branch.branchName;
    const parents = await Parent.find({ branchId })
      .populate({
        path: 'children',      
        select: 'childName'     
      })
      .populate({
        path: 'schoolId',     
        select: 'schoolName'    
      })
      .lean();
    const transformedParents = await Promise.all(
      parents.map(async (parent) => {
        let decryptedPassword;
        try {
          decryptedPassword = decrypt(parent.password);
        } catch (decryptError) {
          console.error(
            `Error decrypting password for parent ${parent.parentName}`,
            decryptError
          );
          return null;
        }

        const transformedChildren = parent.children.map((child) => ({
          childId: child._id,
          childName: child.childName
        }));

        return {
          parentId : parent._id,
          parentName: parent.parentName,
          email: parent.email,
          password: decryptedPassword,
          phone: parent.phone,
          children: transformedChildren,
          fcmToken: parent.fcmToken,
          statusOfRegister: parent.statusOfRegister,
          schoolId: parent.schoolId?._id || parent.schoolId,   
          schoolName: parent.schoolId?.schoolName || "",        
          branchId: parent.branchId,
          registrationDate: formatDateToDDMMYYYY(new Date(parent.parentRegistrationDate))
        };
      })
    );

    const filteredParents = transformedParents.filter(
      (parent) => parent !== null
    );

    const response = {
      branchName: branchName,
      parents: filteredParents,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching parents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/pending-requests", branchAuthMiddleware, async (req, res) => {
  try {
    const { branchId } = req;

    console.log("Branch ID:", branchId);

    if (!branchId) {
      return res.status(400).json({ error: "Branch ID not provided" });
    }
    const requests = await Request.find({
      statusOfRequest: "pending",
      branchId,
    })
      .populate({
        path: "childId",
        populate: {
          path: "schoolId branchId",
          select: "schoolName branchName",
        },
        select: "childName class schoolId branchId",
      })
      .populate("parentId", "parentName email phone")
      .lean();

    console.log("Fetched Requests:", requests);
    const validRequests = requests.filter(
      (request) => request.parentId && request.childId
    );

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
        deviceName: request.childId.deviceName,
        deviceId:request.childId.deviceId,
        childName: request.childId.childName,
        branchName: request.childId.branchId?.branchName || null, 
        schoolName: request.childId.schoolId?.schoolName || null,
        requestType: request.requestType,
        requestDate: request.requestDate
          ? formatDateToDDMMYYYY(new Date(request.requestDate))
          : null,
      };
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

      return formattedRequest;
    });

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
router.get("/approved-requests", branchAuthMiddleware, async (req, res) => {
  try {
    const { branchId } = req;
    const branch = await Branch.findById(branchId).lean();
    const branchName = branch ? branch.branchName : null;
    const school = branch ? await School.findById(branch.schoolId).lean() : null;
    const schoolName = school ? school.schoolName : null;
    const requests = await Request.find({
      statusOfRequest: "approved",
      branchId,
    })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName class")
      .lean();
    const validRequests = requests.filter(
      (request) => request.parentId && request.childId
    );
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
        deviceName: request.childId.deviceName,
        deviceId:request.childId.deviceId,
        formattedRequestDate: request.requestDate
          ? formatDateToDDMMYYYY(new Date(request.requestDate))
          : null,
        schoolName: schoolName, 
        branchName: branchName, 
      };
      if (request.requestType === "leave") {
        formattedRequest.startDate = request.startDate || null;
        formattedRequest.endDate = request.endDate || null;
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

      return formattedRequest;
    });
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
router.get("/denied-requests", branchAuthMiddleware, async (req, res) => {
  try {
    const { branchId } = req;
    const branch = await Branch.findById(branchId).lean();
    const branchName = branch ? branch.branchName : null;
    const school = branch ? await School.findById(branch.schoolId).lean() : null;
    const schoolName = school ? school.schoolName : null;
    const deniedRequests = await Request.find({
      statusOfRequest: "denied",
      branchId,
    })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName deviceId class")
      .lean();
    const validRequests = deniedRequests.filter(
      (request) => request.parentId && request.childId
    );
    const formattedRequests = validRequests.map((request) => ({
      childId: request.childId._id,
      childName: request.childId.childName,
      deviceId: request.childId.deviceId,
      class: request.childId.class,
      statusOfRequest: request.statusOfRequest,
      parentName: request.parentId.parentName,
      email: request.parentId.email,
      phone: request.parentId.phone,
      requestDate: request.requestDate,
      deviceName: request.childId.deviceName,
      deviceId:request.childId.deviceId,
      formattedRequestDate: request.requestDate
        ? formatDateToDDMMYYYY(new Date(request.requestDate))
        : null,
      schoolName: schoolName, 
      branchName: branchName, 
    }));

    res.status(200).json({ requests: formattedRequests });
  } catch (error) {
    console.error("Error fetching denied requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/read-drivers", branchAuthMiddleware, async (req, res) => {
  const { branchId } = req;
  try {
    const drivers = await DriverCollection.find({ branchId })
      .populate({
        path: 'branchId',
        select: 'branchName'
      })
      .populate({
        path: 'schoolId', 
        select: 'schoolName'
      })
      .lean();

    const driverData = drivers
      .map((driver) => {
        try {
          console.log(
            `Decrypting password for driver: ${driver.driverName}, encryptedPassword: ${driver.password}`
          );
          const decryptedPassword = decrypt(driver.password);
          return {
            id: driver._id,
            driverName: driver.driverName,
            address: driver.address,
            driverMobile: driver.driverMobile,
            email: driver.email,
            deviceName:driver.deviceName,
            deviceId: driver.deviceId,
            password: decryptedPassword,
            statusOfRegister:driver.statusOfRegister,
            registrationDate: driver.registrationDate,
            formattedRegistrationDate: formatDateToDDMMYYYY(
              new Date(driver.registrationDate)
            ),
            branchName: driver.branchId ? driver.branchId.branchName : 'Branch not found', 
            schoolName: driver.schoolId ? driver.schoolId.schoolName : 'School not found', 
          };
        } catch (decryptError) {
          console.error(
            `Error decrypting password for driver: ${driver.driverName}`,
            decryptError
          );
          return null;
        }
      })
      .filter((driver) => driver !== null);

    res.status(200).json({ drivers: driverData });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/read-supervisors", branchAuthMiddleware, async (req, res) => {
  const { branchId } = req;

  try {
    const supervisors = await Supervisor.find({ branchId })
      .populate("branchId", "branchName")
      .populate("schoolId", "schoolName")
      .lean();

    const supervisorData = supervisors.map((supervisor) => {
      try {
        console.log(
          `Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`
        );
        const decryptedPassword = decrypt(supervisor.password);
        return {
          id : supervisor._id,
          supervisorName: supervisor.supervisorName,
          address: supervisor.address,
          phone_no: supervisor.phone_no,
          email: supervisor.email,
          deviceId: supervisor.deviceId,
          password: decryptedPassword,
          statusOfRegister:supervisor.statusOfRegister,
          deviceName:supervisor.deviceName,
          registrationDate: supervisor.registrationDate,
          formattedRegistrationDate: formatDateToDDMMYYYY(
            new Date(supervisor.registrationDate)
          ),
          branchName: supervisor.branchId.branchName, 
          schoolName: supervisor.schoolId.schoolName, 
        };
      } catch (decryptError) {
        console.error(
          `Error decrypting password for supervisor: ${supervisor.supervisorName}`,
          decryptError
        );
        return null;
      }
    }).filter((supervisor) => supervisor !== null);

    res.status(200).json({ supervisors: supervisorData });
  } catch (error) {
    console.error("Error fetching supervisors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/pickup-drop-status", branchAuthMiddleware, async (req, res) => {
  try {
    const branchId = req.branchId;
    const attendanceRecords = await Attendance.find({})
      .populate({
        path: "childId",
        match: { branchId },
        populate: [
          { path: "parentId", select: "phone" },
          { path: "branchId", select: "branchName" },
          { path: "schoolId", select: "schoolName" } 
        ]
      })
      .lean();
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
          deviceName: record.childId.deviceName,
          pickupPoint: record.childId.pickupPoint,
          dropStatus: record.drop,
          dropTime: record.dropTime,
          date:record.date
        };
      });

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/present-children", branchAuthMiddleware, async (req, res) => {
  try {
    const branchId = req.branchId;
    const attendanceRecords = await Attendance.find({ pickup: true })
      .populate({
        path: "childId",
        match: { branchId },
        populate: [
          { path: "parentId", select: "phone" },
          { path: "branchId", select: "branchName" }, 
          { path: "schoolId", select: "schoolName" }
        ]
      })
      .lean();
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
          deviceName: record.childId.deviceName,
          pickupPoint: record.childId.pickupPoint,
          branchName: record.childId.branchId ? record.childId.branchId.branchName : 'N/A',
          schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : 'N/A',
          date:record.date
        };
      });

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/absent-children", branchAuthMiddleware, async (req, res) => {
  try {
    const branchId = req.branchId;
    const attendanceRecords = await Attendance.find({ pickup: false })
      .populate({
        path: "childId",
        match: { branchId },
        populate: [
          { path: "parentId", select: "phone" }, 
          { path: "branchId", select: "branchName" }, 
          { path: "schoolId", select: "schoolName" }
        ]
      })
      .lean();
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
          deviceName: record.childId.deviceName,
          pickupPoint: record.childId.pickupPoint,
          branchName: record.childId.branchId ? record.childId.branchId.branchName : 'N/A',
          schoolName: record.childId.schoolId ? record.childId.schoolId.schoolName : 'N/A',
          date:record.date
        };
      });

    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error("Error fetching absent children data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/status-of-children", branchAuthMiddleware, async (req, res) => {
  try {
    const branchId = req.branchId;
    const children = await Child.find({ branchId })
      .populate('parentId')
      .populate('schoolId') 
      .populate({
        path: 'branchId',
        select: 'branchName'
      })
      .lean();
    if (!children.length) {
      return res.status(404).json({ message: "No children found in this branch" });
    }
    const attendancePromises = children.map(child =>
      Attendance.findOne({ childId: child._id })
        .sort({ date: -1 })
        .limit(1)
        .lean()
    );
    const requestPromises = children.map(child =>
      Request.findOne({ childId: child._id })
        .sort({ requestDate: -1 })
        .limit(1)
        .lean()
    );
    const supervisorPromises = children.map(child =>
      child.deviceId
        ? Supervisor.findOne({ deviceId: child.deviceId, branchId }).lean()
        : null
    );
    const [attendances, requests, supervisors] = await Promise.all([
      Promise.all(attendancePromises),
      Promise.all(requestPromises),
      Promise.all(supervisorPromises)
    ]);
    const filteredResponse = children
      .map((child, index) => {
        const attendance = attendances[index];
        const request = requests[index];
        const parent = child.parentId;
        const school = child.schoolId;
        const branch = child.branchId;
        const supervisor = supervisors[index];
        if (attendance || request) {
          return {
            childId: child._id,
            childName: child.childName,
            childClass: child.class,
            deviceId:child.deviceId,
            deviceName:child.deviceName,
            parentName: parent ? parent.parentName : null,
            parentNumber: parent ? parent.phone : null,
            pickupStatus: attendance
              ? attendance.pickup
                ? "Present"
                : "Absent"
              : null,
            dropStatus: attendance ? (attendance.drop ? "Present" : "Absent") : null,
            pickupTime: attendance ? attendance.pickupTime : null,
            dropTime: attendance ? attendance.dropTime : null,
            date: attendance ? attendance.date : null,
            requestType: request ? request.requestType : null,
            startDate:null,
            endDate: null,
            reason: request ? request.reason || null : null,
            newRoute: request ? request.newRoute || null : null,
            statusOfRequest: request ? request.statusOfRequest : null,
            requestDate: request ? formatDateToDDMMYYYY(request.requestDate) : null,
            supervisorName: supervisor ? supervisor.supervisorName : null,
            branchName: branch ? branch.branchName : 'Unknown Branch',
            schoolName: school ? school.schoolName : 'Unknown School'
          };
        }
        return null;
      })
      .filter(child => child !== null); 
    res.json(filteredResponse);
  } catch (error) {
    console.error("Error fetching child statuses:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.get('/status/:childId', branchAuthMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await Child.findOne({ _id: childId })
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
      .lean(); 

    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const parent = child.parentId;
    const branch = child.branchId;
    const school = child.schoolId;
    const attendance = await Attendance.findOne({ childId })
      .sort({ date: -1 })
      .limit(1);
    const request = await Request.findOne({ childId })
      .sort({ requestDate: -1 })
      .limit(1);
    let supervisor = null;
    if (child.deviceId) {
      supervisor = await Supervisor.findOne({ deviceId: child.deviceId, schoolId: child.schoolId });
    }
    const response = {};
    if (child.childName) response.childName = child.childName;
    if (child.class) response.childClass = child.class;
    if (child.deviceId) response.deviceId = child.deviceId;
    if (child.deviceName) response.deviceName = child.deviceName;
    if (parent && parent.parentName) response.parentName = parent.parentName;
    if (parent && parent.phone) response.parentNumber = parent.phone;
    if (branch && branch.branchName) response.branchName = branch.branchName;
    if (school && school.schoolName) response.schoolName = school.schoolName;
    if (attendance && attendance.pickup !== undefined) response.pickupStatus = attendance.pickup ? 'Present' : 'Absent';
    if (attendance && attendance.drop !== undefined) response.dropStatus = attendance.drop ? 'Present' : 'Absent';
    if (attendance && attendance.pickupTime) response.pickupTime = attendance.pickupTime;
    if (attendance && attendance.dropTime) response.dropTime = attendance.dropTime;
    if (attendance && attendance.date) response.date = attendance.date;
    if (request && request.requestType) response.requestType = request.requestType;
    if (request && request.startDate) response.startDate = formatDateToDDMMYYYY(request.startDate);
    if (request && request.endDate) response.endDate = formatDateToDDMMYYYY(request.endDate);
    if (request && request.requestDate) response.requestDate = formatDateToDDMMYYYY(request.requestDate);
    if (request && request.reason) response.reason = request.reason;
    if (request && request.newRoute) response.newRoute = request.newRoute;
    if (request && request.statusOfRequest) response.statusOfRequest = request.statusOfRequest;
    if (supervisor && supervisor.supervisorName) response.supervisorName = supervisor.supervisorName;
    res.json({child:response});
  } catch (error) {
    console.error('Error fetching child status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// router.get('/geofences', async (req, res) => {
//   try {
//     const geofences = await Geofencing.find();
//     const groupedGeofences = geofences.reduce((acc, geofence) => {
//       const deviceId = geofence.deviceId.toString();
//       if (!acc[deviceId]) {
//         acc[deviceId] = [];
//       }
//       acc[deviceId].push({
//         _id: geofence._id,
//         name: geofence.name,
//         area: geofence.area,
//         isCrossed: geofence.isCrossed,
//         deviceId: geofence.deviceId,
//         __v: geofence.__v
//       });
//       return acc;
//     }, {});
//     const transformedResponse = Object.entries(groupedGeofences).reduce((acc, [deviceId, geofences]) => {
//       acc[`deviceId: ${deviceId}`] = geofences;
//       return acc;
//     }, {});
//     res.status(200).json(transformedResponse);
//   } catch (error) {
//     res.status(500).json({ message: 'Error retrieving geofences', error });
//   }
// });



// POST METHOD
router.get("/geofences", branchAuthMiddleware, async (req, res) => {
  const { branchId } = req;

  try {
    // Fetch the branch associated with the branchId
    const branch = await Branch.findById(branchId).select('branchName');
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // Fetch the devices associated with the logged-in branch
    const devices = await Device.find({ branchId }).select('deviceId branchId');

    if (devices.length === 0) {
      return res.status(404).json({ message: "No devices found for this branch" });
    }

    // Extract deviceIds to search geofences
    const deviceIds = devices.map(device => device.deviceId);

    // Fetch geofences that are associated with these deviceIds
    const geofences = await Geofencing.find({ deviceId: { $in: deviceIds } });

    if (geofences.length === 0) {
      return res.status(404).json({ message: "No geofences found for the devices of this branch" });
    }

    // Group geofences by their deviceId
    const geofencesByDevice = deviceIds.map(deviceId => {
      return {
        deviceId: deviceId,
        geofences: geofences.filter(geofence => geofence.deviceId.toString() === deviceId.toString())
      };
    });

    // Respond with geofences for each device
    res.status(200).json({
      branchId: branchId,
      branchName: branch.branchName,
      devices: geofencesByDevice
    });

  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({ message: "Error retrieving geofences", error });
  }
});


router.post("/review-request/:requestId",branchAuthMiddleware,async (req, res) => {
    try {
      const { statusOfRequest } = req.body;
      const { requestId } = req.params;
      const { branchId } = req;
      if (!["approved", "denied"].includes(statusOfRequest)) {
        return res.status(400).json({ error: "Invalid statusOfRequest" });
      }
      const request = await Request.findById(requestId);
      if (request.branchId.toString() !== branchId.toString()) {
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
      const notifyParent = (parentId, message) => {
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
router.post("/registerStatus/:parentId",branchAuthMiddleware,async (req, res) => {
    try {
      const { parentId } = req.params;
      const { action } = req.body;
      const { branchId } = req;
      const parent = await Parent.findOne({ _id: parentId, branchId });
      if (!parent) {
        return res
          .status(404)
          .json({
            error: "Parent not found or does not belong to this branch",
          });
      }
      if (action === "approve") {
        parent.statusOfRegister = "approved";
      } else if (action === "reject") {
        parent.statusOfRegister = "rejected";
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }
      await parent.save();
      res.status(200).json({ message: `Registration ${action}d successfully.` });
    } catch (error) {
      console.error("Error during registration status update:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
router.post("/registerStatus-supervisor/:supervisorId/",branchAuthMiddleware,async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const { action } = req.body;
    const { branchId } = req;
    const supervisor = await Supervisor.findOne({ _id: supervisorId, branchId });
    if (!supervisor) {
      return res
        .status(404)
        .json({
          error: "supervisor not found or does not belong to this branch",
        });
    }
    if (action === "approve") {
      supervisor.statusOfRegister = "approved";
    } else if (action === "reject") {
      supervisor.statusOfRegister = "rejected";
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    await supervisor.save();
    res.status(200).json({ message: `Registration ${action}d successfully.` });
  } catch (error) {
    console.error("Error during registration status update:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
);
router.post("/registerStatus-driver/:driverId/",branchAuthMiddleware,async (req, res) => {
  try {
    const { driverId } = req.params;
    const { action } = req.body;
    const { branchId } = req;
    const driver = await DriverCollection.findOne({ _id: driverId, branchId });
    if (!driver) {
      return res
        .status(404)
        .json({
          error: "driver not found or does not belong to this branch",
        });
    }
    if (action === "approve") {
      driver.statusOfRegister = "approved";
    } else if (action === "reject") {
      driver.statusOfRegister = "rejected";
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    await driver.save();
    res
      .status(200)
      .json({ message: `Registration ${action}d successfully.` });
  } catch (error) {
    console.error("Error during registration status update:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
);
router.post('/add-device', branchAuthMiddleware, async (req, res) => {
  try {
    const { deviceId, deviceName, schoolName, branchName } = req.body;
    if (!deviceId || !deviceName || !schoolName || !branchName) {
      return res.status(400).json({ message: 'All fields (deviceId, deviceName, schoolName, branchName) are required' });
    }
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found in the specified school' });
    }
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ message: 'Device with this ID already exists' });
    }
    const newDevice = new Device({
      deviceId,
      deviceName,
      schoolId: school._id, 
      branchId: branch._id   
    });
    await newDevice.save();
    branch.devices.push(newDevice._id);
    await branch.save();
    res.status(201).json({ message: 'Device created successfully', device: newDevice });
  } catch (error) {
    console.error('Error adding device:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});





// PUT METHOD
router.put("/update-child/:childId", branchAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const { deviceId, ...updateFields } = req.body;
  const { branchId } = req;
  try {
    const child = await Child.findOne({ _id: childId, branchId });
    if (!child) {
      return res
        .status(404)
        .json({ error: "Child not found or does not belong to this branch" });
    }
    if (deviceId) {
      child.deviceId = deviceId;
    }
    Object.keys(updateFields).forEach((field) => {
      child[field] = updateFields[field];
    });
    await child.save();
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
      formattedRegistrationDate: formatDateToDDMMYYYY(
        new Date(updatedChild.registrationDate)
      ),
    };
    res
      .status(200)
      .json({
        message: "Child information updated successfully",
        child: transformedChild,
      });
  } catch (error) {
    console.error("Error updating child information:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/update-parent/:id", branchAuthMiddleware, async (req, res) => {
  const parentId = req.params.id;
  const { parentName, email, password, phone } = req.body;
  const { branchId } = req;
  try {
    const parent = await Parent.findOne({ _id: parentId, branchId });
    if (!parent) {
      return res
        .status(404)
        .json({ error: "Parent not found or does not belong to this branch" });
    }
    if (parentName) parent.parentName = parentName;
    if (email) parent.email = email;
    if (phone) parent.phone = phone;
    if (password) parent.password = password;
    await parent.save();
    res.status(200).json({
      message: "Parent updated successfully",
      parent: {
        ...parent.toObject(),
      },
    });
  } catch (error) {
    console.error("Error updating parent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/update-supervisor/:id", branchAuthMiddleware, async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const branchId = req.branchId;
    const { deviceId, ...updateFields } = req.body;
    const supervisor = await Supervisor.findOne({
      _id: supervisorId,
      branchId,
    });
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }
    if (deviceId) {
      supervisor.deviceId = deviceId;
    }
    Object.keys(updateFields).forEach((field) => {
      supervisor[field] = updateFields[field];
    });
    await supervisor.save();
    const updatedSupervisor = await Supervisor.findById(supervisorId).lean();
    let decryptedPassword = "";
    try {
      console.log(
        `Decrypting password for supervisor: ${updatedSupervisor.supervisorName}, encryptedPassword: ${updatedSupervisor.password}`
      );
      decryptedPassword = decrypt(updatedSupervisor.password);
    } catch (decryptError) {
      console.error(
        `Error decrypting password for supervisor: ${updatedSupervisor.supervisorName}`,
        decryptError
      );
    }
    const transformedSupervisor = {
      ...updatedSupervisor,
      password: decryptedPassword,
      registrationDate: formatDateToDDMMYYYY(
        new Date(updatedSupervisor.registrationDate)
      ),
    };
    console.log(
      "Updated supervisor data:",
      JSON.stringify(transformedSupervisor, null, 2)
    );
    res
      .status(200)
      .json({
        message: "Supervisor information updated successfully",
        supervisor: transformedSupervisor,
      });
  } catch (error) {
    console.error("Error updating supervisor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/update-driver/:id", branchAuthMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const branchId = req.branchId;
    const { deviceId, ...updateFields } = req.body;
    const driver = await DriverCollection.findOne({ _id: driverId, branchId });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    if (deviceId) {
      driver.deviceId = deviceId;
    }
    Object.keys(updateFields).forEach((field) => {
      driver[field] = updateFields[field];
    });
    await driver.save();
    const updatedDriver = await DriverCollection.findById(driverId).lean();
    let decryptedPassword = "";
    try {
      console.log(
        `Decrypting password for driver: ${updatedDriver.driverName}, encryptedPassword: ${updatedDriver.password}`
      );
      decryptedPassword = decrypt(updatedDriver.password);
    } catch (decryptError) {
      console.error(
        `Error decrypting password for driver: ${updatedDriver.driverName}`,
        decryptError
      );
    }
    const transformedDriver = {
      ...updatedDriver,
      password: decryptedPassword,
      registrationDate: formatDateToDDMMYYYY(
        new Date(updatedDriver.registrationDate)
      ),
    };
    console.log(
      "Updated driver data:",
      JSON.stringify(transformedDriver, null, 2)
    );
    res
      .status(200)
      .json({
        message: "Driver information updated successfully",
        driver: transformedDriver,
      });
  } catch (error) {
    console.error("Error updating driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put('/edit-device/:actualDeviceId', branchAuthMiddleware, async (req, res) => {
  try {
    const { actualDeviceId } = req.params; 
    const { deviceId, deviceName, branchName, schoolName } = req.body; 
    if (!deviceId || !deviceName || !branchName || !schoolName) {
      return res.status(400).json({ message: 'deviceId, deviceName, branchName, and schoolName are required' });
    }
    const existingDevice = await Device.findOne({
      deviceId,
      _id: { $ne: actualDeviceId }
    });
    if (existingDevice) {
      return res.status(400).json({ message: 'Device with this deviceId already exists' });
    }
    const device = await Device.findById(actualDeviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    device.deviceId = deviceId;
    device.deviceName = deviceName;
    const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found in the specified school' });
    }
    if (!branch.devices.includes(device._id)) {
      branch.devices.push(device._id);
      await branch.save();
    }
    await device.save();
    res.status(200).json({ message: 'Device updated successfully', device });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/edit-branch/:id', branchAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { branchName, email, schoolMobile, username, password } = req.body;

    // Find the branch by ID
    const existingBranch = await Branch.findById(id);
    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Check if the username is already taken by another branch
    const duplicateBranch = await Branch.findOne({
      _id: { $ne: id }, 
      username 
    });
    
    if (duplicateBranch) {
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
router.delete("/delete/child/:childId",branchAuthMiddleware,async (req, res) => {
    const { childId } = req.params;
    const { branchId } = req;
    try {
      const child = await Child.findOne({ _id: childId, branchId }).lean();
      if (!child) {
        return res
          .status(404)
          .json({ error: "Child not found or does not belong to this branch" });
      }
      let parentData = {};
      if (child.parentId) {
        const parent = await Parent.findOne({
          _id: child.parentId,
          branchId,
        }).lean();
        if (parent) {
          parentData = {
            parentName: parent.parentName,
            email: parent.email,
            phone: parent.phone,
            parentId: parent._id,
          };
          const childCount = await Child.countDocuments({
            parentId: child.parentId,
            branchId,
          });
          if (childCount === 1) {
            await Parent.findByIdAndDelete(child.parentId);
          }
        }
      }
      await Child.findByIdAndDelete(childId);
      console.log("Deleted child data:", JSON.stringify(child, null, 2));
      if (parentData.parentId) {
        console.log(
          "Associated parent data:",
          JSON.stringify(parentData, null, 2)
        );
      }
      res.status(200).json({
        message: "Child deleted successfully",
        child,
        parent: parentData,
      });
    } catch (error) {
      console.error("Error deleting child:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
router.delete("/delete-parent/:id", branchAuthMiddleware, async (req, res) => {
  const parentId = req.params.id;
  const { branchId } = req;
  try {
    const parent = await Parent.findOne({ _id: parentId, branchId }).lean();
    if (!parent) {
      return res
        .status(404)
        .json({ error: "Parent not found or does not belong to this branch" });
    }
    await Child.deleteMany({ _id: { $in: parent.children }, branchId });
    await Parent.findByIdAndDelete(parentId);
    res
      .status(200)
      .json({ message: "Parent and associated children deleted successfully" });
  } catch (error) {
    console.error("Error deleting parent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.delete("/delete-driver/:id", branchAuthMiddleware, async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const branchId = req.branchId;
    const deletedDriver = await DriverCollection.findOneAndDelete({
      _id: driverId,
      branchId,
    });

    if (!deletedDriver) {
      return res
        .status(404)
        .json({ error: "Driver not found or does not belong to your branch" });
    }

    console.log("Deleted driver data:", JSON.stringify(deletedDriver, null, 2));
    res.status(200).json({ message: "Driver deleted successfully" });
  } catch (error) {
    console.error("Error deleting driver:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.delete("/delete-supervisor/:id",branchAuthMiddleware,async (req, res) => {
    try {
      const { id: supervisorId } = req.params;
      const branchId = req.branchId; 
      const deletedSupervisor = await Supervisor.findOneAndDelete({
        _id: supervisorId,
        branchId,
      });

      if (!deletedSupervisor) {
        return res
          .status(404)
          .json({
            error: "Supervisor not found or does not belong to your branch",
          });
      }

      console.log(
        "Deleted supervisor data:",
        JSON.stringify(deletedSupervisor, null, 2)
      );
      res.status(200).json({ message: "Supervisor deleted successfully" });
    } catch (error) {
      console.error("Error deleting supervisor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
router.delete('/delete-device/:actualDeviceId', branchAuthMiddleware, async (req, res) => {
  try {
    const { actualDeviceId } = req.params;
    const device = await Device.findById(actualDeviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    await Device.deleteOne({ _id: actualDeviceId });
    res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.delete('/delete-branch/:id', branchAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the branch by ID and delete it
    const deletedBranch = await Branch.findByIdAndDelete(id);
    
    if (!deletedBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.status(200).json({ message: 'Branch deleted successfully', branch: deletedBranch });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
