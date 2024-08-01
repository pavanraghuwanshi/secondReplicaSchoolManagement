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
  
  module.exports = { formatDateToDDMMYYYY };
  