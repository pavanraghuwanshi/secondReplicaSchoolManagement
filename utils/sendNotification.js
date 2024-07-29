// utils/sendNotification.js
const admin = require('../firebase');

async function sendNotification(parentId, payload) {
  const parent = await Parent.findById(parentId);
  const fcmToken = parent.fcmToken; // Ensure you store this token when parents register/login

  if (!fcmToken) {
    console.error('FCM token not found for parent:', parentId);
    return;
  }

  const message = {
    notification: {
      title: `Attendance Update for Child ${payload.childId}`,
      body: payload.status ? 'Your child is present today.' : 'Your child is absent today.',
    },
    token: fcmToken,
  };

  try {
    await admin.messaging().send(message);
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

module.exports = sendNotification;
