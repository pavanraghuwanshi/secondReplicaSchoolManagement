const admin = require('../config/firebaseadmin'); 
// Initialize Firebase Admin SDK if not done already
// Make sure to initialize with service account credentials
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
