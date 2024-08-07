const express = require("express");
const router = express.Router();
const School = require("../models/school");
const Child = require("../models/child");
const Request = require("../models/request");
const Parent = require("../models/Parent");
const Supervisor = require("../models/supervisor");
const Attendance = require("../models/attendence");
const { schoolAuthMiddleware } = require("../jwt");
const { decrypt } = require('../models/cryptoUtils');
const DriverCollection = require('../models/driver');
const { formatDateToDDMMYYYY } = require('../utils/dateUtils');
const jwt = require("jsonwebtoken");
// School Registration Route
router.post("/register", async (req, res) => {
  const { schoolName, username, password } = req.body;

  try {
    const existingSchool = await School.findOne({ username });
    if (existingSchool) {
      return res.status(400).json({ error: "School username already exists" });
    }
    const newSchool = new School({ schoolName, username, password });
    await newSchool.save();

    res.status(201).json({ message: "School registered successfully" });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// School Login Route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const school = await School.findOne({ username });
    if (!school) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Compare password using the schema method
    const isMatch = await school.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: school._id, username: school.username },
      process.env.JWT_SECRET
    );
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET METHOD 
// Get children with device IDs
router.get("/read/all-children", schoolAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({}).lean();
    console.log("Raw children data:", JSON.stringify(children, null, 2));

    const transformedChildren = await Promise.all(
      children.map(async (child) => {
        if (!child.parentId) {
          return null; // Skip children without a parentId
        }

        const parent = await Parent.findById(child.parentId).lean();
        if (!parent) {
          return null; // Skip children whose parent is not found
        }

        console.log("Parent data:", JSON.stringify(parent, null, 2));

        const parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id,
        };

        return {
          ...child,
          ...parentData,
          formattedRegistrationDate: formatDateToDDMMYYYY(new Date(child.registrationDate)),
        };
      })
    );

    // Filter out null values from the transformedChildren array
    const filteredChildren = transformedChildren.filter(child => child !== null);

    console.log(
      "Transformed children data:",
      JSON.stringify(filteredChildren, null, 2)
    );
    res.status(200).json({ children: filteredChildren });
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all pending requests
router.get("/pending-requests", schoolAuthMiddleware, async (req, res) => {
  try {
    const requests = await Request.find({ statusOfRequest: "pending" })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName class")
      .lean();

    // Filter out requests where parent or child does not exist
    const validRequests = requests.filter(request => request.parentId && request.childId);

    const formattedRequests = validRequests.map((request) => ({
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
      requestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null,
    }));

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
// Get all approved requests
router.get("/approved-requests", schoolAuthMiddleware, async (req, res) => {
  try {
    const approvedRequests = await Request.find({ statusOfRequest: "approved" })
      .populate("parentId", "parentName email phone")
      .populate("childId", "childName class")
      .lean();

    // Filter out requests where parent or child does not exist
    const validRequests = approvedRequests.filter(request => request.parentId && request.childId);

    const formattedRequests = validRequests.map((request) => ({
      childName: request.childId.childName,
      statusOfRequest: request.statusOfRequest,
      class: request.childId.class,
      parentName: request.parentId.parentName,
      email: request.parentId.email,
      phone: request.parentId.phone,
      requestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null
    }));

    res.status(200).json({
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching approved requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});
// Get all children with denied requests
router.get('/denied-requests', schoolAuthMiddleware, async (req, res) => {
  try {
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
      requestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null
    }));

    res.status(200).json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error fetching denied requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get all drivers
router.get('/read/alldrivers', schoolAuthMiddleware, async (req, res) => {
  try {
    const drivers = await DriverCollection.find({});
    const driverData = drivers.map(driver => {
      try {
        console.log(`Decrypting password for driver: ${driver.driverName}, encryptedPassword: ${driver.password}`);
        const decryptedPassword = decrypt(driver.password);
        return {
          id:driver._id,
          driverName: driver.driverName,
          address: driver.address,
          phone_no: driver.phone_no,
          email: driver.email,
          deviceId: driver.deviceId,
          password: decryptedPassword,
          registrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate))
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
        return null;
      }
    }).filter(driver => driver !== null);
    res.status(200).json({ drivers: driverData });
  } catch (error) {
    console.error('Error fetching drivers:', error); // Detailed error logging
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get all supervisor
router.get('/read/allsupervisors', schoolAuthMiddleware, async (req, res) => {
  try {
    const supervisors = await Supervisor.find({});
    const supervisorData = supervisors.map(supervisor => {
      try {
        console.log(`Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`);
        const decryptedPassword = decrypt(supervisor.password);
        return {
          id:supervisor._id,
          supervisorName: supervisor.supervisorName,
          address: supervisor.address,
          phone_no: supervisor.phone_no,
          email: supervisor.email,
          deviceId: supervisor.deviceId,
          password: decryptedPassword,
          registrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate))
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
        return null;
      }
    }).filter(driver => driver !== null);
    res.status(200).json({ supervisors: supervisorData });
  } catch (decryptError) {
    console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
    return null;
  }
});
router.get('/read/data-by-deviceId', schoolAuthMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Fetch Supervisor data
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
          registrationDate: formatDateToDDMMYYYY(new Date(supervisor.registrationDate))
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for supervisor: ${supervisor.supervisorName}`, decryptError);
      }
    }

    // Fetch Driver data
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
          registrationDate: formatDateToDDMMYYYY(new Date(driver.registrationDate))
        };
      } catch (decryptError) {
        console.error(`Error decrypting password for driver: ${driver.driverName}`, decryptError);
      }
    }

    // Fetch Child data
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
router.get("/pickup-drop-status", schoolAuthMiddleware, async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find({})
      .populate({
        path: "childId",
        populate: {
          path: "parentId"
        }
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
          deviceId:record.childId.deviceId,
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

// POST METHOD
//review request
router.post("/review-request/:requestId",schoolAuthMiddleware,async (req, res) => {
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

      // Assuming notifyParent is a function to send notifications
      const notifyParent = (parentId, message) => {
        // Your notification logic here
        console.log(`Notification to parentId ${parentId}: ${message}`);
      };

      notifyParent(
        request.parentId,
        `Your request has been ${statusOfRequest}.`
      );

      res
        .status(200)
        .json({ message: "Request reviewed successfully", request });
    } catch (error) {
      console.error("Error reviewing request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

//PUT METHOD
// Update child information
router.put('/update-child/:childId', schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const { deviceId, ...updateFields } = req.body;
  try {
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
// update driver
router.put('/update-driver/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
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
// update the supervsior
router.put('/update-supervisor/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const supervisorId = req.params.id;
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
router.delete("/delete/:childId", schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    let parentData = {};
    if (child.parentId) {
      const parent = await Parent.findById(child.parentId).lean();
      if (parent) {
        parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id,
        };
        const childCount = await Child.countDocuments({
          parentId: child.parentId,
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
});
// delete driver
router.delete('/delete/driver/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    
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
// delete supervisor
router.delete('/delete/supervisor/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const supervisorId = req.params.id;

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
module.exports = router;
