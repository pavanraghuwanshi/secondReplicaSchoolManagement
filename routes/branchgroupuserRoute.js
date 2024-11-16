const express = require('express');
const router = express.Router();


const { authenticateBranchGroupUser } = require('../middleware/authmiddleware');
const { getChildByBranchGroup,registerParentByBranchgroup,approveParentByBranchgroup,presentchildrenByBranchgroup,updatechildByBranchgroup,deleteChildByBranchgroup } = require('../controllers/branchgroupuserController');



router.post("/registerparentbybranchgroup",authenticateBranchGroupUser,registerParentByBranchgroup)
router.post("/approveParentByBranchgroup/:parentId",authenticateBranchGroupUser,approveParentByBranchgroup)



router.get("/read-children",authenticateBranchGroupUser,getChildByBranchGroup)
router.get("/presentchildrenByBranchgroup",authenticateBranchGroupUser,presentchildrenByBranchgroup)




router.put("/updatechildbybranchgroup/:id", authenticateBranchGroupUser,updatechildByBranchgroup )




// router.delete("/deletechildbybranchgroup/:id", authenticateBranchGroupUser,deleteChildByBranchgroup )


module.exports = router;

