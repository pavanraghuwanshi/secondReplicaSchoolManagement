const express = require("express");
const Parent = require("../models/Parent");
const Child = require("../models/child");
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const router = express.Router();
require('dotenv').config();
const Attendance = require('../models/attendence')
const Request = require("../models/request");
const School = require("../models/school");
const Branch = require('../models/branch');
const DriverCollection = require("../models/driver");
const Device = require('../models/device');



router.post('/register', async (req, res) => {
  try {
    const {
      parentName,
      email,
      password,
      phone,
      childName,
      class: childClass,
      rollno,
      section,
      schoolName,
      branchName,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      deviceName,
      deviceId,
      fcmToken 
    } = req.body;
    if (!schoolName || !branchName) {
      return res.status(400).json({ error: 'School name and branch name are required' });
    }
    const existingParent = await Parent.findOne({ email });
    if (existingParent) {
      return res.status(400).json({ error: 'Parent email already exists' });
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
    const newParent = new Parent({
      parentName,
      email,
      password, 
      phone,
      fcmToken ,
      schoolId: school._id,
      branchId: branch._id,
      statusOfRegister: 'pending'
    });
    await newParent.save();

    // Create new child linked to the school, branch, and parent
    const newChild = new Child({
      childName,
      class: childClass,
      rollno,
      section,
      schoolId: school._id,
      branchId: branch._id, 
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      deviceName,
      deviceId,
      parentId: newParent._id
    });
    await newChild.save();

    // Link child to parent
    newParent.children.push(newChild._id);
    await newParent.save();

    // Generate JWT token
    const payload = { id: newParent._id, email: newParent.email, schoolId: school._id, branchId: branch._id };
    const token = generateToken(payload);

    res.status(201).json({ parent: newParent, child: newChild, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/add-child', jwtAuthMiddleware, async (req, res) => {
  try {
    const {
      childName,
      class: childClass,
      rollno,
      section,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      deviceName,
      deviceId
    } = req.body;

    // Extract parentId from the JWT token payload (set during login)
    const parentId = req.user.id;

    // Find the parent to get the current schoolId and branchId
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    // Get schoolId and branchId directly from the parent data
    const { schoolId, branchId } = parent;

    // Fetch schoolName using the schoolId
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(400).json({ error: 'School not found' });
    }

    const schoolName = school.schoolName;

    // Create new child with the parentId, schoolId, and branchId from the parent
    const newChild = new Child({
      childName,
      class: childClass,
      rollno,
      section,
      dateOfBirth,
      childAge,
      gender,
      pickupPoint,
      deviceName,
      deviceId,
      parentId,
      schoolId,  
      branchId,  
      schoolName 
    });

    // Save the new child in the database
    await newChild.save();

    // Add the new child's ID to the parent's list of children
    await Parent.findByIdAndUpdate(parentId, { $push: { children: newChild._id } });

    // Respond with the created child
    res.status(201).json({ child: newChild });
  } catch (error) {
    console.error('Error during adding child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.put('/update-fcm-token', async (req, res) => {
  try {
    const { parentId, fcmToken } = req.body;

    if (!parentId || !fcmToken) {
      return res.status(400).json({ error: 'Parent ID and FCM token are required' });
    }

    // Find the parent by ID
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Update the FCM token
    parent.fcmToken = fcmToken;
    await parent.save();

    res.status(200).json({ message: 'FCM token updated successfully', parent });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the parent by email
    const parent = await Parent.findOne({ email });

    // Check if parent exists
    if (!parent) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare provided password with stored hashed password
    const isMatch = await parent.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Check if the registration status is approved
    if (parent.statusOfRegister !== 'approved') {
      return res.status(400).json({ error: "Account not approved yet" });
    }

    // Find the school associated with the parent
    const school = await School.findById(parent.schoolId);

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Generate JWT token with parent ID, email, and schoolId
    const token = generateToken({
      id: parent._id,
      email: parent.email,
      schoolId: parent.schoolId,
      branchId: parent.branchId,
      role:"parent"
    });

    // Send success response with token and the fullAccess status
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      fullAccess: school.fullAccess // Return the fullAccess status
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: "Server error" });
  }
});



router.get('/getschools', async (req, res) => {
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
});
router.get('/get-devices', async (req, res) => {
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

    // Fetch devices linked to the branch
    const devices = await Device.find({ branchId: branch._id }).exec();

    // Format the response
    const response = devices.map(device => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName
    }));

    res.status(200).json({ devices: response });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/getchilddata', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const deviceId = req.user.id;
    const schoolId = req.user.schoolId; 
    const parent = await Parent.findById(parentId).populate({
      path: 'children',
      match: { schoolId: schoolId }, 
      populate:[ {
        path: 'branchId', 
        select: 'branchName schoolMobile', 
      },{
        path: 'schoolId',
        select: 'schoolName schoolMobile' 
      }]
    }).exec();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    const children = parent.children;
    const deviceIds = children.map(child => child.deviceId);
    const drivers = await DriverCollection.find({ deviceId: { $in: deviceIds } }).select('deviceId driverMobile').exec();
    const driverMap = new Map(drivers.map(driver => [driver.deviceId, driver.driverMobile]));
    const childrenData = children.map(child => ({
      _id: child._id,
      childName: child.childName,
      class: child.class,
      rollno: child.rollno,
      section: child.section,
      schoolName: child.schoolId.schoolName,
      dateOfBirth: child.dateOfBirth,
      childAge: child.childAge,
      pickupPoint: child.pickupPoint,
      schoolId: child.schoolId._id,
      branchName: child.branchId?.branchName || "N/A",
      schoolMobile: child.schoolId?.schoolMobile || child.branchId?.schoolMobile  || "N/A", 
      deviceName: child.deviceName,
      gender: child.gender,
      parentId: child.parentId,
      deviceId: child.deviceId,
      registrationDate: child.registrationDate,
      driverMobile: driverMap.get(child.deviceId) || "N/A" 
    }));
    res.status(200).json({ children: childrenData });
  } catch (error) {
    console.error('Error fetching child data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/get-parent-data', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const schoolId = req.user.schoolId; // Assuming schoolId is in the JWT payload
    
    // Find the parent by ID and exclude the password field
    const parent = await Parent.findById(parentId).select('-password');

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Check if the schoolId matches
    if (parent.schoolId.toString() !== schoolId) {
      return res.status(403).json({ error: 'Unauthorized access to this school data' });
    }

    res.status(200).json({ parent });
  } catch (error) {
    console.error('Error fetching parent data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/getrequests', jwtAuthMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const schoolId = req.user.schoolId; // Get the schoolId from the authenticated user

    // Fetch the parent data along with their children, ensuring the correct school context
    const parent = await Parent.findOne({ _id: parentId, schoolId }).populate('children', '_id childName');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to the authenticated school' });
    }

    // Collect all child IDs
    const childIds = parent.children.map(child => child._id);

    // Fetch all requests for the children, ensuring the requests are within the same school context
    const requests = await Request.find({ childId: { $in: childIds }, schoolId })
      .select('requestType startDate endDate reason newRoute childId requestDate')
      .populate('childId', 'childName');

    // Group the requests
    const groupedRequests = [];

    requests.forEach(request => {
      if (request.requestType === 'leave') {
        // Handle leave requests by storing them as an array for each child
        groupedRequests.push({
          childName: request.childId.childName,
          requestType: 'leave',
          reason: request.reason,
          startDate: request.startDate,
          endDate: request.endDate,
          requestDate: request.requestDate
        });
      } else {
        // Handle changeRoute requests
        groupedRequests.push({
          childName: request.childId.childName,
          requestType: request.requestType,
          reason: request.reason,
          newRoute: request.newRoute,
          requestDate: request.requestDate
        });
      }
    });

    res.status(200).json({ requests: groupedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/status/:childId', jwtAuthMiddleware, async (req, res) => {
  const { childId } = req.params;
  const parentId = req.user.id;
  const schoolId = req.user.schoolId;

  try {
    // Find the child based on childId, parentId, and schoolId
    const child = await Child.findOne({ _id: childId, parentId, schoolId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent/school' });
    }

    const now = new Date();
    const currentDate = now.toDateString();  // Current date string like "Tue Oct 10 2024"

    // Fetch today's attendance record based on childId and schoolId
    let attendanceRecord = await Attendance.findOne({ childId, schoolId });

    if (attendanceRecord) {
      const recordDate = new Date(attendanceRecord.date).toDateString();  // Get the date from the record

      // Reset attendance data if the record date is not today (after 12 AM)
      if (recordDate !== currentDate) {
        attendanceRecord.pickup = null;
        attendanceRecord.drop = null;
        attendanceRecord.pickupTime = null;
        attendanceRecord.dropTime = null;
        attendanceRecord.date = now;  // Update to today's date
        await attendanceRecord.save();  // Save the reset data
      }
    } else {
      // No attendance record found, initialize a blank response
      attendanceRecord = {
        pickup: null,
        drop: null,
        pickupTime: null,
        dropTime: null,
        date: null
      };
    }

    // Return the attendance data
    res.status(200).json({
      childId: childId,
      pickupStatus: attendanceRecord.pickup || null,
      dropStatus: attendanceRecord.drop || null,
      date: attendanceRecord.date ? new Date(attendanceRecord.date).toDateString() : null,
      pickupTime: attendanceRecord.pickupTime || null,
      dropTime: attendanceRecord.dropTime || null
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.put('/update-child/:childId', jwtAuthMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const { childName, class: childClass, rollno, section, schoolName, dateOfBirth, childAge, gender } = req.body;
    const parentId = req.user.id;
    const schoolId = req.schoolId;

    // Find the child by ID, parentId, and schoolId
    const child = await Child.findOne({ _id: childId, parentId, schoolId });
    if (!child) {
      return res.status(404).json({ error: 'Child not found or does not belong to the authenticated parent or school' });
    }

    // Update the child details
    child.childName = childName || child.childName;
    child.class = childClass || child.class;
    child.rollno = rollno || child.rollno;
    child.section = section || child.section;
    child.schoolName = schoolName || child.schoolName;
    child.dateOfBirth = dateOfBirth || child.dateOfBirth;
    child.childAge = childAge || child.childAge;
    child.gender = gender || child.gender;

    await child.save();

    res.status(200).json({ child });
  } catch (error) {
    console.error('Error during updating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.put("/update-parent/:parentId", jwtAuthMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { parentName, email, phone } = req.body;

    // Ensure the authenticated parent is the one being updated
    if (parentId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only update your own profile' });
    }

    // Find the parent by ID and ensure they belong to the correct school (if applicable)
    const parent = await Parent.findOne({ _id: parentId, schoolId: req.schoolId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or incorrect token' });
    }

    // Update the parent's details
    parent.parentName = parentName || parent.parentName;
    parent.email = email || parent.email;
    parent.phone = phone || parent.phone;

    await parent.save();

    res.status(200).json({ parent });
  } catch (error) {
    console.error('Error during updating parent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.delete('/delete', jwtAuthMiddleware, async (req, res) => {
  try {
    // Extract parentId from the token's decoded data
    const parentId = req.user.id; // Assuming the decoded token attaches the parent ID to req.user

    // Find the parent by ID
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Delete all children associated with the parent
    await Child.deleteMany({ parentId: parent._id });

    // Delete the parent
    await Parent.findByIdAndDelete(parentId);

    res.status(200).json({ message: 'Parent and associated children deleted successfully' });
  } catch (error) {
    console.error('Error during deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})
router.post('/import', async (req, res) => {
  try {
    const registrationData = req.body;

    if (!Array.isArray(registrationData) || registrationData.length === 0) {
      return res.status(400).json({ error: 'No registration data provided' });
    }

    const processedParents = [];

    const registrationPromises = registrationData.map(async (data) => {
      const {
        parentName,
        email,
        password,
        phone,
        childName,
        class: childClass,
        rollno,
        section,
        schoolName,
        branchName,
        dateOfBirth,
        childAge,
        gender,
        pickupPoint,
        deviceName,
        deviceId,
        fcmToken
      } = data;

      if (!schoolName || !branchName) {
        throw new Error(`School name and branch name are required for child: ${childName}`);
      }

      // Find or create the parent
      let parent = await Parent.findOne({ email });
      
      if (!parent) {
        // If the parent does not exist, create a new parent
        const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
        if (!school) {
          throw new Error(`School not found: ${schoolName}`);
        }

        const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
        if (!branch) {
          throw new Error(`Branch not found in the specified school: ${branchName}`);
        }

        parent = new Parent({
          parentName,
          email,
          password,
          phone,
          fcmToken,
          schoolId: school._id,
          branchId: branch._id,
          statusOfRegister: 'pending'
        });

        await parent.save();
      }

      // Now handle child creation regardless of parent existence
      const newChild = new Child({
        childName,
        class: childClass,
        rollno,
        section,
        schoolId: parent.schoolId, // Use parent's school and branch
        branchId: parent.branchId,
        dateOfBirth,
        childAge,
        gender,
        pickupPoint,
        deviceName,
        deviceId,
        parentId: parent._id
      });

      await newChild.save();

      // Link child to parent
      parent.children.push(newChild._id);
      await parent.save();

      // Generate JWT token for the parent if they didn't have one
      const payload = { id: parent._id, email: parent.email, schoolId: parent.schoolId, branchId: parent.branchId };
      const token = generateToken(payload);

      processedParents.push({ parent, child: newChild, token });
    });

    await Promise.all(registrationPromises);

    res.status(201).json({ registeredParents: processedParents });
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

