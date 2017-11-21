const _ = require('lodash');

exports.isEqualArray = function (arr1, arr2) {
  return _.isEqual(_.sortBy(arr1), _.sortBy(arr2));
}
