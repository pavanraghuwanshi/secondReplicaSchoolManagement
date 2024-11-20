const { generateToken } = require("../jwt");
const Parent = require("../models/Parent");
const School = require("../models/school");
const Branch = require('../models/branch');
const Attendance = require("../models/attendence");
const Child = require("../models/child");
const Geofencing = require("../models/geofence");
const branch = require("../models/branch");
const Request = require("../models/request");
const Supervisor = require("../models/supervisor");
const { decrypt } = require("../models/cryptoUtils");
const { formatDateToDDMMYYYY } = require("../utils/dateUtils");






exports.registerParentByBranchgroup = async (req, res) => {
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
    const newChild = new child({
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
};

exports.getChildByBranchGroup = async (req, res) => {
     try {

          const branches = req.user.branches          
          
          const childData = await Child.find({ branchId: branches })
          .populate("schoolId","schoolName" )
          .populate("parentId","parentName" )
          .populate("branchId","branchName" );
          

        res.status(200).json({
          message: "Child data retrieved successfully",
          childData
        });
      
     } catch (error) {

      res.status(500).json({ error: 'Internal server error p' });

     }
   }

exports.approveParentByBranchgroup = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { action } = req.body;
    // const { schoolId } = req;

    const parent = await Parent.findOne({ _id: parentId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found or does not belong to this user' });
    }

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
};

exports.updatechildByBranchgroup = async (req, res) => {
  const { id } = req.params;
  
  const { schoolName, branchName, parentName, email, phone, password, deviceId, deviceName, ...updateFields } = req.body;

  try {
    const child = await Child.findById(id);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    if (schoolName && branchName) {
      const school = await School.findOne({ schoolName: new RegExp(`^${schoolName.trim()}$`, 'i') }).populate('branches');
      if (!school) {
        return res.status(400).json({ error: 'School not found' });
      }

      const branch = school.branches.find(branch => branch.branchName.toLowerCase() === branchName.trim().toLowerCase());
      if (!branch) {
        return res.status(400).json({ error: 'Branch not found in the specified school' });
      }

      child.schoolId = school._id;
      child.branchId = branch._id;
    }

    if (deviceId) {
      child.deviceId = deviceId;
    }
    if (deviceName) {
      child.deviceName = deviceName;
    }

    Object.keys(updateFields).forEach((field) => {
      child[field] = updateFields[field];
    });

    if (child.parentId) {
      const parent = await Parent.findById(child.parentId);
      if (parent) {
        if (parentName) parent.parentName = parentName;
        if (email) parent.email = email;
        if (phone) parent.phone = phone;
        if (password) {
          parent.password = password; 
        }

        await parent.save(); 
      }
    }

    await child.save(); 

    const updatedChild = await Child.findById(id).lean();
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
      // formattedRegistrationDate: formatDateToDDMMYYYY(new Date(updatedChild.registrationDate)),
    };

    res.status(200).json({ message: 'Child information updated successfully', child: transformedChild });
  } catch (error) {
    console.error('Error updating child information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.deleteChildByBranchgroup =  async (req, res) => {
  const { childId } = req.params;
  // const { schoolId } = req;

  try {

    const child = await Child.findById(childId).lean();
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }
              

    let parentData = {};
    if (child.parentId) {

      const parent = await Parent.findOne({ _id: child.parentId }).lean();
      if (parent) {
        parentData = {
          parentName: parent.parentName,
          email: parent.email,
          phone: parent.phone,
          parentId: parent._id,
        };

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
};


exports.Pendingrequests = async (req, res) => {
  try {
    const branches = req.user.branches; 

    const requestsByBranches = await Promise.all(branches.map(async (branchId) => {
      const branch = await Branch.findById(branchId).lean();
      if (!branch) return null;

      const branchName = branch.branchName;

      const requests = await Request.find({
        statusOfRequest: "pending",
        branchId: branchId,
      })
        .populate({
          path: "childId",
          select: "childName class deviceId",
        })
        .populate("parentId", "parentName email phone")
        .lean();

      // const validRequests = requests.filter(
      //   (request) => request.parentId && request.childId
      // );

      // const formattedRequests = validRequests.map((request) => {
      //   const formattedRequest = {
      //     requestId: request._id,
      //     reason: request.reason,
      //     class: request.childId.class,
      //     statusOfRequest: request.statusOfRequest,
      //     parentId: request.parentId._id,
      //     parentName: request.parentId.parentName,
      //     phone: request.parentId.phone,
      //     email: request.parentId.email,
      //     childId: request.childId._id,
      //     childName: request.childId.childName,
      //     requestType: request.requestType,
      //     deviceId: request.childId.deviceId,
      //     deviceName: request.childId.deviceName,
      //     requestDate: request.requestDate
      //       ? formatDateToDDMMYYYY(new Date(request.requestDate))
      //       : null,
      //     branchName: branchName,
      //   };

      //   if (request.requestType === "leave") {
      //     formattedRequest.startDate = request.startDate
      //       ? formatDateToDDMMYYYY(new Date(request.startDate))
      //       : null;
      //     formattedRequest.endDate = request.endDate
      //       ? formatDateToDDMMYYYY(new Date(request.endDate))
      //       : null;
      //   } else if (request.requestType === "changeRoute") {
      //     formattedRequest.newRoute = request.newRoute || null;
      //   }

      //   return formattedRequest;
      // });

      return {
        branchId: branchId,
        branchName: branchName,
        requests
      };
    }));

    const filteredBranches = requestsByBranches.filter(branch => branch !== null);

    res.status(200).json({
      data: filteredBranches,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};


exports.Approverequests = async (req, res) => {
  try {
    const branches = req.user.branches; 

    const requestsByBranches = await Promise.all(branches.map(async (branchId) => {
      const branch = await Branch.findById(branchId).lean();
      if (!branch) return null;

      const branchName = branch.branchName;

      const requests = await Request.find({
        statusOfRequest: "Approve",
        branchId: branchId,
      })
        .populate({
          path: "childId",
          select: "childName class deviceId",
        })
        .populate("parentId", "parentName email phone")
        .lean();

      // const validRequests = requests.filter(
      //   (request) => request.parentId && request.childId
      // );

      // const formattedRequests = validRequests.map((request) => {
      //   const formattedRequest = {
      //     requestId: request._id,
      //     reason: request.reason,
      //     class: request.childId.class,
      //     statusOfRequest: request.statusOfRequest,
      //     parentId: request.parentId._id,
      //     parentName: request.parentId.parentName,
      //     phone: request.parentId.phone,
      //     email: request.parentId.email,
      //     childId: request.childId._id,
      //     childName: request.childId.childName,
      //     requestType: request.requestType,
      //     deviceId: request.childId.deviceId,
      //     deviceName: request.childId.deviceName,
      //     requestDate: request.requestDate
      //       ? formatDateToDDMMYYYY(new Date(request.requestDate))
      //       : null,
      //     branchName: branchName,
      //   };

      //   if (request.requestType === "leave") {
      //     formattedRequest.startDate = request.startDate
      //       ? formatDateToDDMMYYYY(new Date(request.startDate))
      //       : null;
      //     formattedRequest.endDate = request.endDate
      //       ? formatDateToDDMMYYYY(new Date(request.endDate))
      //       : null;
      //   } else if (request.requestType === "changeRoute") {
      //     formattedRequest.newRoute = request.newRoute || null;
      //   }

      //   return formattedRequest;
      // });

      return {
        branchId: branchId,
        branchName: branchName,
        requests
      };
    }));

    const filteredBranches = requestsByBranches.filter(branch => branch !== null);

    res.status(200).json({
      data: filteredBranches,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};


exports.Deniedrequests = async (req, res) => {
  try {
    const branches = req.user.branches; 

    const requestsByBranches = await Promise.all(branches.map(async (branchId) => {
      const branch = await Branch.findById(branchId).lean();
      if (!branch) return null;

      const branchName = branch.branchName;

      const requests = await Request.find({
        statusOfRequest: "Denied",
        branchId: branchId,
      })
        .populate({
          path: "childId",
          select: "childName class deviceId",
        })
        .populate("parentId", "parentName email phone")
        .lean();

      // const validRequests = requests.filter(
      //   (request) => request.parentId && request.childId
      // );

      // const formattedRequests = validRequests.map((request) => {
      //   const formattedRequest = {
      //     requestId: request._id,
      //     reason: request.reason,
      //     class: request.childId.class,
      //     statusOfRequest: request.statusOfRequest,
      //     parentId: request.parentId._id,
      //     parentName: request.parentId.parentName,
      //     phone: request.parentId.phone,
      //     email: request.parentId.email,
      //     childId: request.childId._id,
      //     childName: request.childId.childName,
      //     requestType: request.requestType,
      //     deviceId: request.childId.deviceId,
      //     deviceName: request.childId.deviceName,
      //     requestDate: request.requestDate
      //       ? formatDateToDDMMYYYY(new Date(request.requestDate))
      //       : null,
      //     branchName: branchName,
      //   };

      //   if (request.requestType === "leave") {
      //     formattedRequest.startDate = request.startDate
      //       ? formatDateToDDMMYYYY(new Date(request.startDate))
      //       : null;
      //     formattedRequest.endDate = request.endDate
      //       ? formatDateToDDMMYYYY(new Date(request.endDate))
      //       : null;
      //   } else if (request.requestType === "changeRoute") {
      //     formattedRequest.newRoute = request.newRoute || null;
      //   }

      //   return formattedRequest;
      // });

      return {
        branchId: branchId,
        branchName: branchName,
        requests
      };
    }));

    const filteredBranches = requestsByBranches.filter(branch => branch !== null);

    res.status(200).json({
      data: filteredBranches,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};































exports.presentchildrenByBranchgroup = async (req, res) => {
  try {
    const branchIds = req.user.branches; 

    const branches = await Branch.find({ _id: { $in: branchIds } }).lean();

    const dataByBranch = await Promise.all(
      branches.map(async (branch) => {
        const branchId = branch._id.toString();
        const branchName = branch.branchName;
        const schoolId = branch.schoolId.toString();

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
              date: record.date,
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

    res.status(200).json({ branches: dataByBranch });
  } catch (error) {
    console.error("Error fetching present pickup data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};




exports.readSuperviserByBranchGroupUser = async (req, res) => {
  const branches = req.user.branches    
  // console.log(branches)      
  

  try {
    const supervisors = await Supervisor.find({ branchId:branches })
      .populate("branchId", "branchName")
      .populate("schoolId", "schoolName")
      .lean();
      // console.log(supervisors)
    const supervisorData = supervisors.map((supervisor) => {
      try {
        // console.log(
        //   `Decrypting password for supervisor: ${supervisor.supervisorName}, encryptedPassword: ${supervisor.password}`
        // );
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
};

exports.updateSupervisorByBranchGroupUser = async (req, res) => {
  try {
    const { supervisorName, address, phone, email } = req.body;
    const supervisorId = req.params.id;

    // Update supervisor details, ensuring they belong to the correct school
    const supervisor = await Supervisor.findOneAndUpdate(
      { _id: supervisorId },
      { supervisorName, address, phone, email },
      { new: true }
    );

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found or does not belong to this school" });
    }

    return res.status(200).json({ message: "Supervisor details updated successfully", supervisor });
  } catch (error) {
    console.error("Error updating supervisor details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteSupervisorByBranchGroupUser = async (req, res) => {
  try {
    const supervisorId = req.params.id;
    const supervisor = await Supervisor.findByIdAndDelete(supervisorId);
    if (!supervisor) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }
    return res.status(200).json({ message: 'Supervisor deleted successfully' });
  } catch (error) {
    console.error('Error during supervisor deletion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};