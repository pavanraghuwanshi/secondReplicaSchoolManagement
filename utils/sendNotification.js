// const admin = require('firebase-admin');

// // Initialize Firebase Admin SDK
// const serviceAccount = require('../firebase.json'); // Adjust path as needed

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// // Function to send push notifications
// const sendNotification = (token, title, body) => {
//   const message = {
//     notification: {
//       title,
//       body
//     },
//     token
//   };

//   admin.messaging().send(message)
//     .then((response) => {
//       console.log('Successfully sent message:', response);
//     })
//     .catch((error) => {
//       console.error('Error sending message:', error);
//     });
// };

// module.exports = sendNotification;
