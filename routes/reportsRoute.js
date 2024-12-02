const express = require('express');
const router = express.Router();

const { getNotification, createNotificationtypes } = require('../controllers/notificationhistory');



router.get("/notificationalerthistory",getNotification)
router.post("/createnotification",createNotificationtypes)



module.exports = router;

