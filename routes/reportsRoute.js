const express = require('express');
const router = express.Router();

const { getNotification, createNotificationtypes, getNotificationTypes, updateNotificationTypes, deleteNotificationTypes } = require('../controllers/notificationhistory');



router.get("/notificationalerthistory",getNotification)
router.get("/getnotificationtypes",getNotificationTypes)
router.post("/createnotification",createNotificationtypes)
router.put("/updatenotification/:id",updateNotificationTypes)
router.delete("/deletenotification/:id",deleteNotificationTypes)



module.exports = router;

