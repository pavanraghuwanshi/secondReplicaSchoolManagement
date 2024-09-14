const express = require("express");
const app = express();
require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");

// Initialize the database connection
require("./db/db");

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define the port to use
const PORT = process.env.PORT || 3000;

// Import routes
const childRoutes = require("./routes/childRoute");
const driverRoutes = require("./routes/driverRoute");
const supervisorRoutes = require("./routes/supervisorRoute");
const requestRoutes = require('./routes/requestRoute');
const schoolRoutes = require('./routes/schoolRoute');
const geofence = require('./routes/geofenceRoute');
const superAdminRoutes = require('./routes/superAdminRoute')
const branchRoute = require('./routes/branchRoute');

// Use routes
app.use("/parent", childRoutes);
app.use("/driver", driverRoutes);
app.use("/supervisor", supervisorRoutes);
app.use('/request',requestRoutes);
app.use('/geofence',geofence);
app.use('/school',schoolRoutes);
app.use("/superadmin",superAdminRoutes);
app.use("/branch",branchRoute);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});

// Root route to confirm backend setup
app.get('/', (req, res) => {
  res.json({
    message: "Backend is set up in DevOps",
    environment: process.env.NODE_ENV || 'development'
  });
});