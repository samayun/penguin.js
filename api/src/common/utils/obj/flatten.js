/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const { Types } = require('mongoose');

// Declare a flatten function that takes
// object as parameter and returns the
// flatten object
const flattenObj = ob => {
  // The object which contains the
  // final result
  const result = {};

  // loop through the object "ob"
  for (const i in ob) {
    // We check the type of the i using
    // typeof() function and recursively
    // call the function again
    if (!(ob[i] instanceof Types.ObjectId) && typeof ob[i] === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObj(ob[i]);
      for (const j in temp) {
        // Store temp in result
        result[`${i}.${j}`] = temp[j];
      }
    }

    // Else store ob[i] in result directly
    else {
      result[i] = ob[i];
    }
  }
  return result;
};

exports.flattenObj = flattenObj;
