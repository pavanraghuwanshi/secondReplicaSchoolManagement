  const mongoose = require("mongoose");
  const bcrypt = require("bcrypt");

  const driverSchema = new mongoose.Schema({
  driver_id: {
    type: Number,
    required: true,
  },
  profileImage: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone_no: {
    type: String,
    required: true,
  },
  vehicleId: {
    type: String,
    required: true,
  },
  schoolId: {
    type: String,
    required: true,
  },
  aadhar: {
    type: String,
    required: true,
  },
  aadharImage: {
    type: String,
    required: true,
  },
  license: {
    type: String,
    required: true,
  },
  licenseImage: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: false,
  },
  password: {
    type: String,
    required: false,
  },
  });
  driverSchema.pre("save", async function (next) {
  const driver = this;
  if (!driver.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(driver.password, salt);
    driver.password = hashedPassword;
    next();
  } catch (err) {
    return next(err);
  }
  });

  driverSchema.methods.comparePassword = async function (password) {
  try {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
  };

  const Driver = mongoose.model("driverData", driverSchema);
  module.exports = Driver;
