// dateTimeUtils.js
const moment = require('moment-timezone');
/**
 * Formats the date to dd-mm-yyyy.
 * @param {Date} date 
 * @returns {string}
 */
const formatDateToDDMMYYYY = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Formats the time to hh:mm:ss.
 * @param {Date} date 
 * @param {number} offset 
 * @returns {string}
 */
// const formatTime = (date) => {
//   return moment(date).tz('Asia/Kolkata').format('HH:mm:ss');
// };

const formatTime = (date) => {
  return moment(date).tz('Asia/Kolkata').format('hh:mm A');
};

module.exports = { formatDateToDDMMYYYY, formatTime };
