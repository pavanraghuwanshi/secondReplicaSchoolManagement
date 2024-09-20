// const admin = require('firebase-admin');

// // Initialize Firebase Admin SDK
// const serviceAccount = require('../serviceaccount.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// const sendNotification = async (token, title, body) => {
//   const message = {
//     token,
//     notification: {
//       title,
//       body
//     }
//   };

//   try {
//     await admin.messaging().send(message);
//     console.log('Notification sent successfully');
//   } catch (error) {
//     console.error('Error sending notification:', error);
//   }
// };

// export default {sendNotification}