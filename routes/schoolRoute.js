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
// Get children with vehicle IDs
router.get("/read/all-children", schoolAuthMiddleware, async (req, res) => {
  try {
    const children = await Child.find({}).lean();
    console.log("Raw children data:", JSON.stringify(children, null, 2));

    const transformedChildren = await Promise.all(
      children.map(async (child) => {
        let parentData = {};
        if (child.parentId) {
          const parent = await Parent.findById(child.parentId).lean();
          console.log("Parent data:", JSON.stringify(parent, null, 2));

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

        return {
          ...child,
          ...parentData,
          registrationDate: {
            formatted: formatDateToDDMMYYYY(new Date(child.registrationDate)),
            original: child.registrationDate
          }
        };
      })
    );

    console.log(
      "Transformed children data:",
      JSON.stringify(transformedChildren, null, 2)
    );
    res.status(200).json({ children: transformedChildren });
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

    const formattedRequests = requests.map((request) => ({
      requestId: request._id,
      reason: request.reason,
      class: request.childId ? request.childId.class : null,
      statusOfRequest: request.statusOfRequest,
      parentId: request.parentId ? request.parentId._id : null,
      parentName: request.parentId ? request.parentId.parentName : null,
      phone: request.parentId ? request.parentId.phone : null,
      email: request.parentId ? request.parentId.email : null,
      childId: request.childId ? request.childId._id : null,
      childName: request.childId ? request.childId.childName : null,
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

    const formattedRequests = approvedRequests.map((request) => ({
      childName: request.childId ? request.childId.childName : null,
      statusOfRequest: request.statusOfRequest,
      class: request.childId.class,
      parentName: request.parentId ? request.parentId.parentName : null,
      email: request.parentId ? request.parentId.email : null,
      phone: request.parentId ? request.parentId.phone : null,
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
      .populate('childId', 'childName vehicleId class')
      .lean();

    // Filter out requests where childId is null or not populated
    const children = deniedRequests
      .filter(request => request.childId)
      .map(request => ({
        childId: request.childId._id,
        childName: request.childId.childName,
        vehicleId: request.childId.vehicleId,
        class: request.childId.class,
        statusOfRequest: request.statusOfRequest,
        parentName: request.parentId ? request.parentId.parentName : null,
        email: request.parentId ? request.parentId.email : null,
        phone: request.parentId ? request.parentId.phone : null,
        requestDate: request.requestDate ? formatDateToDDMMYYYY(new Date(request.requestDate)) : null
      }));

    res.status(200).json({ children });
  } catch (error) {
    console.error('Error fetching children with denied requests:', error);
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
          vehicleId: driver.vehicleId,
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
          vehicleId: supervisor.vehicleId,
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
// Route to get attendance data for admin dashboard
router.get("/pickup-drop-status", schoolAuthMiddleware, async (req, res) => {
  const today = new Date();
  const formattedDate = formatDateToDDMMYYYY(today);
  try {
    const attendanceRecords = await Attendance.find({ date: formattedDate })
      .populate({
        path: "childId",
        populate: {
          path: "parentId"
        }
      })
      .exec();
    const responseData = attendanceRecords.map(record => {
      return {
        childName: record.childId.childName,
        parentNumber: record.childId.parentId.parentNumber,
        class: record.childId.class,
        section: record.childId.section,
        pickupStatus: record.pickup, 
        dropStatus: record.drop 
      };
    });
    res.status(200).json(responseData);
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
        child.vehicleId = request.newRoute;
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
// Assign Vehicle ID to Child
router.post("/admin/assignVehicleId", async (req, res) => {
  const { childId, vehicleId } = req.body;
  try {
    await Child.findByIdAndUpdate(childId, { vehicleId });
    res.send({ message: "Vehicle ID assigned successfully", vehicleId });
  } catch (error) {
    res.status(500).send({ error: "Failed to assign Vehicle ID" });
  }
});


//PUT METHOD
// Update child
router.put("/update/:childId", schoolAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const {
    childName,
    class: childClass,
    rollno,
    section,
    schoolName,
    dateOfBirth,
    childAge,
    gender,
    parentName,
    email,
    phone,
  } = req.body;

  // Separate childData and parentData from the request body
  const childData = {
    childName,
    class: childClass,
    rollno,
    section,
    schoolName,
    dateOfBirth,
    childAge,
    gender,
  };

  const parentData = {
    parentName,
    email,
    phone,
  };

  try {
    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    // Update child data
    const updatedChild = await Child.findByIdAndUpdate(childId, childData, {
      new: true,
    }).lean();
    console.log("Updated child data:", JSON.stringify(updatedChild, null, 2));

    let response = { child: updatedChild };

    // If parent data is provided and child has a parentId, update parent data
    if (
      (parentData.parentName || parentData.email || parentData.phone) &&
      child.parentId
    ) {
      const updatedParent = await Parent.findByIdAndUpdate(
        child.parentId,
        parentData,
        { new: true }
      ).lean();
      console.log(
        "Updated parent data:",
        JSON.stringify(updatedParent, null, 2)
      );

      response.child.parentName = updatedParent.parentName;
      response.child.email = updatedParent.email;
      response.child.phone = updatedParent.phone;
      response.child.parentId = updatedParent._id;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating child:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Update Vehicle ID for Child
router.put("/child/updateVehicleId", async (req, res) => {
  const { childId, vehicleId } = req.body;
  try {
    await Child.findByIdAndUpdate(childId, { vehicleId });
    res.send({ message: "Vehicle ID updated successfully", vehicleId });
  } catch (error) {
    res.status(500).send({ error: "Failed to update Vehicle ID" });
  }
});
// update driver
router.put('/update/driver/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    const updateData = req.body;
    
    const updatedDriver = await DriverCollection.findByIdAndUpdate(driverId, updateData, { new: true });

    if (!updatedDriver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    console.log('Updated driver data:', JSON.stringify(updatedDriver, null, 2));
    res.status(200).json({ driver: updatedDriver });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// update the supervsior
router.put('/update/supervisor/:id', schoolAuthMiddleware, async (req, res) => {
  try {
    const supervisorId = req.params.id;
    const updateData = req.body;

    const updatedSupervisor = await Supervisor.findByIdAndUpdate(supervisorId, updateData, { new: true });

    if (!updatedSupervisor) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    console.log('Updated supervisor data:', JSON.stringify(updatedSupervisor, null, 2));
    res.status(200).json({ supervisor: updatedSupervisor });
  } catch (error) {
    console.error('Error updating supervisor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// DELETE METHD
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
