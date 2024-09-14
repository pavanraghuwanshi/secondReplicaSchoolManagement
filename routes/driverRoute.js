const express = require("express");
const router = express.Router();
const { jwtAuthMiddleware } = require("../jwt");
const driverController = require('../controllers/driverController');


router.post("/register", driverController.registerDriver);
router.post("/login", driverController.loginDriver);
router.get("/getschools", driverController.getSchools);
router.get("/get-devices", driverController.getDevices);
router.get('/getdriverData', jwtAuthMiddleware, driverController.getDriverData);
router.put('/update', jwtAuthMiddleware, driverController.updateDriver);
router.delete('/delete', jwtAuthMiddleware, driverController.deleteDriver);


module.exports = router;