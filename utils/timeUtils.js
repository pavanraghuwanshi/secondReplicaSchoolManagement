const formatTime = (date, offset = 0) => {
  // Ensure date is a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object');
  }

  // Convert date to the specified offset (in milliseconds)
  const localDate = new Date(date.getTime() + offset);
  
  // Format hours, minutes, and seconds with leading zeros
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};

const today = new Date();

// IST Offset (UTC +5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// UTC Offset (UTC 0:00)
const UTC_OFFSET = 0;

// Formatted times
const istTime = formatTime(today, IST_OFFSET);
const utcTime = formatTime(today, UTC_OFFSET);

console.log(`Current IST Time: ${istTime}`);
console.log(`Current UTC Time: ${utcTime}`);
module.exports = { formatTime };