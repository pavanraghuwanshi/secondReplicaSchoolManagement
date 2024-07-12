const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const driverSchema = new mongoose.Schema({
  driverName: {
    type: String,
    required: true,
  },
  email:{
    type: String,
    required: true,
  },
  password:{
    type: String,
    required: true,
  },
  busNo:{
    type: String,
    required: true,
  },
  phoneNo: {
    type: Number,
    required: true,
  },
  route: {
    type: String,
    required: true,
  },
  driverId:{
    type: String,
    required: true,
  }
});

driverSchema.pre('save', async function (next) {
  const driver = this;
  if (!driver.isModified('password')) return next();
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
