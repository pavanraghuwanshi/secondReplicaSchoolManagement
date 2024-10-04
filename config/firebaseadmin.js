// firebaseAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('./parenteye.adminsdk.json'); // Replace with your actual path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optionally, you can set the database URL if you are using the Realtime Database
  // databaseURL: 'https://<YOUR-DATABASE-NAME>.firebaseio.com'
});
console.log("Firebase Admin initialized successfully.");
module.exports = admin;
