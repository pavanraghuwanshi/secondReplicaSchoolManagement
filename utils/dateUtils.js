// dateTimeUtils.js

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
const formatTime = (date, offset = 0) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object');
  }

  const localDate = new Date(date.getTime() + offset);

  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};

module.exports = { formatDateToDDMMYYYY, formatTime };
