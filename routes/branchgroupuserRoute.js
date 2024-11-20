const express = require('express');
const router = express.Router();


const { authenticateBranchGroupUser } = require('../middleware/authmiddleware');
const { getChildByBranchGroup,registerParentByBranchgroup,approveParentByBranchgroup,presentchildrenByBranchgroup,updatechildByBranchgroup,deleteChildByBranchgroup, Pendingrequests, Approverequests, Deniedrequests,getDriverData, updateDriver, deletedriver, AddDevices, readSuperviserByBranchGroupUser, updateSupervisorByBranchGroupUser,deleteSupervisorByBranchGroupUser } = require('../controllers/branchgroupuserController');



router.post("/registerparentbybranchgroup",authenticateBranchGroupUser,registerParentByBranchgroup)
router.post("/approveParentByBranchgroup/:parentId",authenticateBranchGroupUser,approveParentByBranchgroup)
router.post("/adddevicesbybranchgroupuser",authenticateBranchGroupUser,AddDevices)



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
router.get("/getdriverdata",authenticateBranchGroupUser,getDriverData);




router.put("/updatedriverdata/:id",authenticateBranchGroupUser,updateDriver);




router.delete("/updatedriverdata/:id",authenticateBranchGroupUser,deletedriver);









module.exports = router;

