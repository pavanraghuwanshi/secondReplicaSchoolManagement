const Allalert = require("../models/notificationhistory");
const notificationTypes = require("../models/notificationtypes");





exports.createNotificationtypes = async(req,res)=>{

    
    try {
        const { 
            deviceId,
            schoolId,
            branchId,
            deviceName,
            ignitionOn,
            ignitionOff,
            geofenceEnter,
            geofenceExit,
            studentPresent,
            studentAbsent,
            leaveRequestStatus 
        } = req.body;

        if (!Array.isArray(deviceId) || deviceId.length === 0) {
            return res.status(400).json({ message: "Device ID must be a non-empty array" });
        }

        const savedNotifications = [];
        const skippedNotifications = [];

        for (const id of deviceId) {
            const existingNotification = await notificationTypes.findOne({ deviceId: id });

            if (existingNotification) {
                skippedNotifications.push(id);
            } else {
                const newNotificationType = new notificationTypes({
                    deviceId: id,
                    schoolId,
                    branchId,
                    deviceName,
                    ignitionOn,
                    ignitionOff,
                    geofenceEnter,
                    geofenceExit,
                    studentPresent,
                    studentAbsent,
                    leaveRequestStatus
                });

                const savedNotification = await newNotificationType.save();
                savedNotifications.push(savedNotification);
            }
        }

        return res.status(201).json({
            message: "Notification types processed successfully",
            saved: savedNotifications,
            AlreadyExist: skippedNotifications
        });
    } catch (error) {
        console.error("Internal server error:", error);
        return res.status(500).json({ message: "Internal server error", error });
    }

};






exports.getNotificationTypes = async(req,res)=>{

        try {

            const getnotificationtypes = await notificationTypes.find();

            if(getnotificationtypes){
                return res.status(200).json({ getnotificationtypes,message: "Notification Types Fetches Successfully"});
            }
            
        } catch (error) {
            console.log("Internal server error",error);
            
        }
}










// exports.getNotification = async (req, res) => {
//     try {
//         const { duration, startDate, endDate, deviceIds } = req.query;

//         if (!deviceIds) {
//             return res.status(400).json({ message: "Device IDs are required" });
//         }

//         const deviceIdsArray = deviceIds.split(',');
//         let queryStartDate, queryEndDate;

//         if (duration) {
//             const now = new Date();
//             switch (duration) {
//                 case "day":
//                     queryStartDate = new Date(now.setUTCHours(0, 0, 0, 0));
//                     queryEndDate = new Date(now.setUTCHours(23, 59, 59, 999));
//                     break;
//                 case "week":
//                     const weekStart = now.getDate() - now.getDay();
//                     queryStartDate = new Date(now.setDate(weekStart));
//                     queryStartDate.setUTCHours(0, 0, 0, 0);
//                     queryEndDate = new Date(now.setDate(weekStart + 6));
//                     queryEndDate.setUTCHours(23, 59, 59, 999);
//                     break;
//                 case "prevweek":
//                     const prevWeekStart = now.getDate() - now.getDay() - 7;
//                     queryStartDate = new Date(now.setDate(prevWeekStart));
//                     queryStartDate.setUTCHours(0, 0, 0, 0);
//                     queryEndDate = new Date(now.setDate(prevWeekStart + 6));
//                     queryEndDate.setUTCHours(23, 59, 59, 999);
//                     break;
//                 case "month":
//                     queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
//                     queryEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
//                     break;
//                 case "prevmonth":
//                     queryStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//                     queryEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
//                     break;
//                 default:
//                     return res.status(400).json({ message: "Invalid duration value" });
//             }
//         } else if (startDate && endDate) {
//             const parseDate = (dateStr) => {
//                 const [day, month, year] = dateStr.split('-').map(Number);
//                 return new Date(year, month - 1, day);
//             };
//             queryStartDate = parseDate(startDate);
//             queryEndDate = parseDate(endDate);
//             queryEndDate.setUTCHours(23, 59, 59, 999);
//         } else {
//             return res.status(400).json({ message: "Either duration or startDate and endDate must be provided" });
//         }

//         const notifications = await Allalert.find({
//             deviceId: { $in: deviceIdsArray },
//             createdAt: { $gte: queryStartDate, $lte: queryEndDate }
//         });

//         res.status(200).json({ success: true, data: notifications });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

console.log();

exports.getNotification = async (req, res) => {
     try {
         const { duration, startDate, endDate, deviceIds } = req.query;
 
         if (!deviceIds) {
             return res.status(400).json({ message: "Device IDs are required" });
         }
 
         const deviceIdsArray = deviceIds.split(',');
         let queryStartDate, queryEndDate;
 
         if (duration) {
             const now = new Date();
             switch (duration) {
                 case "day":
                     queryStartDate = new Date(now.setUTCHours(0, 0, 0, 0));
                     queryEndDate = new Date(now.setUTCHours(23, 59, 59, 999));
                     break;
                 case "thisweek":
                     const weekStart = now.getDate() - now.getDay();
                     queryStartDate = new Date(now.setDate(weekStart));
                     queryStartDate.setUTCHours(0, 0, 0, 0);
                     queryEndDate = new Date(now.setDate(weekStart + 6));
                     queryEndDate.setUTCHours(23, 59, 59, 999);
                     break;
                 case "prevweek":
                     const prevWeekStart = now.getDate() - now.getDay() - 7;
                     queryStartDate = new Date(now.setDate(prevWeekStart));
                     queryStartDate.setUTCHours(0, 0, 0, 0);
                     queryEndDate = new Date(now.setDate(prevWeekStart + 6));
                     queryEndDate.setUTCHours(23, 59, 59, 999);
                     break;
                 case "month":
                     queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
                     queryEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                     break;
                 case "prevmonth":
                     queryStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                     queryEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                     break;
                 default:
                     return res.status(400).json({ message: "Invalid duration value" });
             }
         } else if (startDate && endDate) {
             queryStartDate = new Date(startDate);
             queryEndDate = new Date(endDate);
             queryEndDate.setUTCHours(23, 59, 59, 999);
         } else {
             return res.status(400).json({ message: "Either duration or startDate and endDate must be provided" });
         }
 
         const notifications = await Allalert.find({
             deviceId: { $in: deviceIdsArray },
             createdAt: { $gte: queryStartDate, $lte: queryEndDate }
         });
 
         res.status(200).json({ success: true, data: notifications });
     } catch (error) {
         res.status(500).json({ success: false, message: error.message });
     }
 };
 