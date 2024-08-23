const DriverCollection = require("../models/driver");
const Geofencing = require('../models/geofence');
const { encrypt } = require('../models/cryptoUtils');
const { generateToken } = require("../jwt");

exports.registerDriver = async (req, res) => {
  try {
    const data = {
      driverName: req.body.driverName,
      phone_no: req.body.phone_no,
      email: req.body.email,
      address: req.body.address,
      password: req.body.password,
      busName:req.body.busName,
      deviceId:req.body.deviceId
    };
    const { email } = data;
    console.log("Received registration data:", data);

    const existingDriver = await DriverCollection.findOne({ email });
    if (existingDriver) {
      console.log("Email already exists");
      return res.status(400).json({ error: "Email already exists" });
    }

    data.encryptedPassword = encrypt(data.password);
    console.log("Encrypted password:", data.encryptedPassword);

    const newDriver = new DriverCollection(data);
    const response = await newDriver.save();
    console.log("Data saved:", response);

    const payload = { id: response.id, email: response.email };
    const token = generateToken(payload);

    res.status(201).json({ response: { ...response.toObject(), password: data.encryptedPassword }, token });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.loginDriver = async (req, res) => {
  const { email, password } = req.body;
  try {
    const driver = await DriverCollection.findOne({ email });
    if (!driver) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await driver.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const token = generateToken({ id: driver._id, email: driver.email });
    res.status(200).json({ success: true, message: "Login successful", token });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getDriverData = async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await DriverCollection.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    let geofencingData = [];
    if (driver.deviceId) {
      geofencingData = await Geofencing.find({ deviceId: driver.deviceId }).lean();
    }

    const transformedGeofencingData = geofencingData.length
      ? geofencingData.map(area => ({
          id: area._id,
          name: area.name,
          description: area.description || '',
          area: area.area,
          calendarId: area.calendarId,
          attributes: area.attributes || {},
          isCrossed: false
        }))
      : [{ id: null, name: 'No geofencing data available', description: '', area: '', calendarId: null, attributes: {} }];

    res.status(200).json({ driver, geofencing: transformedGeofencingData });
  } catch (error) {
    console.error('Error fetching driver data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateDriver = async (req, res) => {
  try {
    const { driverName, address, phone_no, email } = req.body;
    const driverId = req.user.id;
    const driver = await DriverCollection.findOneAndUpdate(
      { _id: driverId },
      { driverName, address, phone_no, email },
      { new: true }
    );
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.status(200).json({ message: "Driver details updated successfully", driver });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating Driver details" });
  }
};

exports.deleteDriver = async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await DriverCollection.findOneAndDelete({ _id: driverId });
    
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.status(200).json({ message: "Driver details deleted successfully", driver });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deleting driver details" });
  }
};
