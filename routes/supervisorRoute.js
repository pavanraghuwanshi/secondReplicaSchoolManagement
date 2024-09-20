const express = require("express");
const router = express.Router();
const {  jwtAuthMiddleware } = require("../jwt");
const supervisorController = require('../controllers/supervisorController');


router.post("/register", supervisorController.registerSupervisor);
router.post("/login", supervisorController.loginSupervisor);
router.get("/getsupervisorData",  jwtAuthMiddleware,supervisorController.getSupervisordata);
router.put("/update",  jwtAuthMiddleware,supervisorController.updateSupervisor);
router.get("/read/all-children",  jwtAuthMiddleware,supervisorController.getallChildren);
router.put('/mark-pickup',jwtAuthMiddleware,supervisorController.markPickup);
router.put('/mark-drop',jwtAuthMiddleware,supervisorController.markDrop);
router.post('/add-geofence',jwtAuthMiddleware,supervisorController.addGeofence);
router.get("/getschools", supervisorController.getSchools);
router.get("/get-devices", supervisorController.getDevices);
router.delete('/delete-geofence/:id',jwtAuthMiddleware,supervisorController.deleteGeofence);
// router.put('/geofencing/:id',jwtAuthMiddleware,supervisorController.updateGeofencing);
// router.put("/update-password",  jwtAuthMiddleware,supervisorController.updatePassword);
router.delete("/delete",  jwtAuthMiddleware,supervisorController.deleteSupervisor);


module.exports = router;