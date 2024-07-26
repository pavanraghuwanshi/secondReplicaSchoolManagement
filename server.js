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
const supervisorRoutes = require("./routes/superVisorRoute");
const requestRoutes = require('./routes/requestRoute');
const schoolRoutes = require('./routes/schoolRoute');

// Use routes
app.use("/parent", childRoutes);
app.use("/driver", driverRoutes);
app.use("/supervisor", supervisorRoutes);
app.use('/request',requestRoutes);
app.use('/school',schoolRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});