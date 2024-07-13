const express = require('express');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize the database connection
const db = require('./db/db');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define the port to use
const PORT = process.env.PORT || 3000;

const childRoutes = require('./routes/childRoute');
const driverRoutes = require('./routes/driverRoute');
const conductorRoutes = require('./routes/conductorRoute');
const leaveRoutes = require('./routes/leaveRequestRoute');

app.use('/parent', childRoutes);
app.use('/driver', driverRoutes);
app.use('/leave', leaveRoutes);
app.use('/conductor', conductorRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
