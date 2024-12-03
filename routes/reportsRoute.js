const express = require('express');
const router = express.Router();

const { getNotification, createNotificationtypes, getNotificationTypes } = require('../controllers/notificationhistory');



router.get("/notificationalerthistory",getNotification)
router.post("/createnotification",createNotificationtypes)
router.get("/getnotificationtypes",getNotificationTypes)



module.exports = router;

