const _ = require('lodash');
const async = require('async');
const chalk = require('chalk');
const cssAnimatedProperties = require('css-animated-properties');
const cssShorthandProperties = require('css-shorthand-properties');

const findSpecs = require('./find-specs');
const specParser = require('./spec-parser');

const util = require('util');
const log = (arg) => { console.log(util.inspect(arg, {depth: null, colors: true})); };

function isEqual(arr1, arr2) {
  return _.isEqual(_.sortBy(arr1), _.sortBy(arr2));
}

function collectSpecUrls() {
  const url = 'http://localhost:8080/test-current-work.html';
  return findSpecs.findAll({ url }).then(function (specList) {
    return specList.map(spec => spec.url);
  });
}

function normaliseLonghands(longhands, allProps, _stack) {
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

function compareShorthands(specs) {
  let headerShown = false;
  specs.forEach((spec) => {
    // log(spec);
    const different = _.compact(spec.propsShorthand.map(({ prop, longhand }) => {
      const existing = cssShorthandProperties.expand(prop);
      const parsed = normaliseLonghands(longhand);
      if (!isEqual(existing, parsed)) {
        return { prop, parsed };
      }
    }));
    if (different.length) {
      if (!headerShown) {
        console.log('\n----- NEW SHORTHANDS: %s -----', chalk.bold('REVIEW CAREFULLY'));
        headerShown = true;
      }
      console.log(chalk.gray(`\n// ${spec.title}: ${spec.url}`));
      formatShorthands(different);
    }
  });
}

function parseAllSpecs(urlList) {
  console.log(urlList);
  async.map(urlList, function (url, done) {
    specParser.parseUrl(url).then(function (props) {
      done(null, props);
    }, function (err) {
      done(err);
    });
  }, function (err, results) {
    console.log('DONE', err, results && results.length);
    if (err) return;
    process.nextTick(() => {
      compareShorthands(results);
      // console.log('DONE', err, util.inspect(
      //   results.map(r => ({title: r.title, short: r.propsShorthand})),
      //   {depth: null, colors: true}
      // ));
    });
  });
}

/* Full run: *\/
collectSpecUrls().then(parseAllSpecs);
/* */

/* Debug: */
// const debugSpecs = ['css-align', 'css-backgrounds', 'css-color-3', 'css-flexbox', 'css-fonts', 'css-grid', 'css-images', 'css-shapes'];
const debugSpecs = ['css-backgrounds', 'css-flexbox', 'css-grid'];
// const debugSpecs = ['css-backgrounds', 'css-flexbox'];
const debugUrls = debugSpecs.map(spec => `http://localhost:8080/${spec}/Overview.html`);
parseAllSpecs(debugUrls);
/* */
