const express = require('express');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser');

// Initialize the database connection
const db = require('./db/db');

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Define the port to use
const PORT = process.env.PORT || 3000;

const studentRoutes = require('./routes/studentRoute');

app.use('/parent', studentRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
