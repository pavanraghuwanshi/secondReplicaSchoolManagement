const express = require('express');
const router = express.Router();


const { authenticateBranchGroupUser } = require('../middleware/authmiddleware');
const { getChildByBranchGroup,registerParentByBranchgroup,approveParentByBranchgroup,presentchildrenByBranchgroup,updatechildByBranchgroup,deleteChildByBranchgroup, Pendingrequests, Approverequests, Deniedrequests,getDriverData, updateDriver, deletedriver, AddDevices, readSuperviserByBranchGroupUser, updateSupervisorByBranchGroupUser,deleteSupervisorByBranchGroupUser, getGeofence, deleteGeofence, getDevices, updateDevice, updateGeofence } = require('../controllers/branchgroupuserController');



router.post("/registerparentbybranchgroup",authenticateBranchGroupUser,registerParentByBranchgroup)
router.post("/approveParentByBranchgroup/:parentId",authenticateBranchGroupUser,approveParentByBranchgroup)



               //    Device Api for Branch Group User
router.post("/adddevicesbybranchgroupuser",authenticateBranchGroupUser,AddDevices)
router.get("/getdevicebranchgroupuser",authenticateBranchGroupUser,getDevices)
router.put("/updateDevicebranchgroupuser/:id",authenticateBranchGroupUser,updateDevice)






router.get("/read-children",authenticateBranchGroupUser,getChildByBranchGroup)
router.get("/presentchildrenByBranchgroup",authenticateBranchGroupUser,presentchildrenByBranchgroup)
router.get("/readSuperviserBybranchgroupuser",authenticateBranchGroupUser,readSuperviserByBranchGroupUser)




router.put("/updatechildbybranchgroup/:id", authenticateBranchGroupUser,updatechildByBranchgroup )
router.patch("/updateSupervisorByBranchGroupUser/:id", authenticateBranchGroupUser,updateSupervisorByBranchGroupUser )




router.delete("/deletechildbybranchgroup/:childId", authenticateBranchGroupUser,deleteChildByBranchgroup )
router.delete("/deleteSupervisorByBranchGroupUser/:id", authenticateBranchGroupUser,deleteSupervisorByBranchGroupUser )






                    //   pending request of leave
router.get("/pendingrequests",authenticateBranchGroupUser,Pendingrequests);
router.get("/approverequests",authenticateBranchGroupUser,Approverequests);
router.get("/deniedrequests",authenticateBranchGroupUser,Deniedrequests);








                    // Driver All crud
router.get("/getdriverdata",authenticateBranchGroupUser,getDriverData);
router.put("/updatedriverdata/:id",authenticateBranchGroupUser,updateDriver);
router.delete("/deletedriverdata/:id",authenticateBranchGroupUser,deletedriver);


                    // geofence all crud apis

router.get("/getgeofence",authenticateBranchGroupUser,getGeofence);
// router.put("/updategeofence",authenticateBranchGroupUser,updateGeofence );
router.delete("/deletegeofence/:id",authenticateBranchGroupUser,deleteGeofence);
   






module.exports = router;

