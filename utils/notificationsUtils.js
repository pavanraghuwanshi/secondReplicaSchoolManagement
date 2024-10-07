const admin = require('../config/firebaseadmin'); 


const sendNotificationToParent = async (fcmToken, title, body) => {
    const message = {
      notification: { title, body },
      token: fcmToken,
    };
  
    try {
      const response = await admin.messaging().send(message);
      console.log("Notification sent successfully", response);
      return true;
    } catch (error) {
      console.error("Error sending notification:", error);
      return false; // Indicating failure
    }
  };
  

module.exports = {
  sendNotificationToParent,
};
