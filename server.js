const express = require('express');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser');
// const cors = require('cors');

// Initialize the database connection
const db = require('./db/db');

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Middleware to enable CORS with specific configuration
// app.use(cors({
//   origin: 'http://localhost:3000', // Replace with your React app's URL
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// Define the port to use
const PORT = process.env.PORT || 3000;

const studentRoutes = require('./routes/studentRoute');
const driverRoutes = require('./routes/driverRoute');
const conductorRoutes = require('./routes/conductorRoute');
const leaveRoutes = require('./routes/leaveRequestRoute');

app.use('/parent', studentRoutes);
app.use('/driver', driverRoutes);
app.use('/leave', leaveRoutes);
app.use('/conductor', conductorRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
