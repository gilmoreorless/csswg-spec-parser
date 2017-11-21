const _ = require('lodash');
const chalk = require('chalk');
const cssShorthandProperties = require('css-shorthand-properties');

const { log } = require('./logger');
const { isEqualArray } = require('./utils');


function normaliseLonghands(longhands, allProps, _stack) {
  log.debug('(normaliseLonghands)', longhands, _stack);
  const byProp = _.keyBy(allProps, 'prop');
  _stack = _stack || []; // Prevents mutually recursive parsed properties (e.g. grid-row and grid-column)
  return _.uniq(_.flatMap(longhands, (longhand) => {
    if (longhand in byProp && !_stack.includes(longhand)) {
      return normaliseLonghands(byProp[longhand].longhand, allProps, _stack.concat(longhand));
    }
    return longhand;
  }));
}

function trimLonghands(prefix, props) {
  return props.map((prop) => {
    return (prop.indexOf(prefix) === 0) ? prop.replace(prefix, '') : prop;
  });
}

function formatShorthands(shorthands) {
  const maxLen = Math.max(...shorthands.map(sh => sh.prop.length));
  const space = (str) => Array(maxLen - str.length).fill(' ').join('');
  shorthands.forEach((sh) => {
    console.log(
      `'${sh.prop}': ${space(sh.prop)}['` +
      trimLonghands(sh.prop, sh.parsed).join(`', '`) +
      `'],`
    );
  });
}

exports.compareShorthands = function (specs) {
  let headerShown = false;
  specs.forEach((spec) => {
    if (!spec) {
      return;
    }
    const different = _.compact(spec.propsShorthand.map(({ prop, longhand }) => {
      if (prop === 'all') {
        return false;
      }
      const existing = _.flattenDeep(cssShorthandProperties.expand(prop, true));
      const parsed = normaliseLonghands(longhand, spec.propsShorthand);
      if (!isEqualArray(existing, parsed)) {
        return { prop, parsed };
      }
      return false;
    }));
    if (different.length) {
      if (!headerShown) {
        console.log(chalk.yellow(chalk`\n----- NEW SHORTHANDS: {black.bgYellow  REVIEW CAREFULLY } -----`));
        headerShown = true;
      }
      console.log(chalk.gray(`\n// ${spec.title}: ${spec.url}`));
      formatShorthands(different);
    }
  });
}
