const _ = require('lodash');
const async = require('async');
const chalk = require('chalk');
const cssAnimatedProperties = require('css-animated-properties');
const cssShorthandProperties = require('css-shorthand-properties');

const findSpecs = require('./find-specs');
const specParser = require('./spec-parser');
const { log } = require('./logger');

function isEqualArray(arr1, arr2) {
  return _.isEqual(_.sortBy(arr1), _.sortBy(arr2));
}


/*** SHORTHANDS ***/

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

function compareShorthands(specs) {
  let headerShown = false;
  specs.forEach((spec) => {
    const different = _.compact(spec.propsShorthand.map(({ prop, longhand }) => {
      const existing = cssShorthandProperties.expand(prop);
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


/*** ANIMATABLE ***/

function normaliseAnimatable(propDef) {
  const longhands = cssShorthandProperties.expand(propDef.prop).filter(p => p !== propDef.prop);
  log.debug('(normaliseAnimatable)', propDef, longhands);
  // TODO: Use parsed shorthands if available
  return longhands;
}

// Very naive stringification, designed specifically for the known keys of this parser
function formatKeyValPairs(obj) {
  let parts = [];
  for (let [key, value] of Object.entries(obj)) {
    parts.push(key + ': ' + JSON.stringify(value).replace(/"/g, "'"));
  }
  return '{' + parts.join(', ') + '}';
}

function formatAnimatable(props) {
  const maxLen = Math.max(...props.map(p => p.propDef.prop.length));
  const space = (str) => Array(maxLen - str.length).fill(' ').join('');
  props.forEach((p) => {
    let pd = p.propDef;
    console.log(
      `'${pd.prop}': ${space(pd.prop)}` +
      formatKeyValPairs(pd.details) + ','
    );
  });
}

function compareAnimatable(specs) {
  let headerShown = false;
  const matched    = (propDef) => ({ propDef, isMatch: true });
  const notMatched = (propDef) => ({ propDef, isMatch: false });

  const compareLog = (title, existing, parsed) => {
    log.info(chalk.bgBlack.white(title));
    log.info(chalk.bold('  Existing:'), existing);
    log.info(chalk.bold('  Parsed:'), parsed);
  };

  specs.forEach((spec) => {
    const normalised = spec.propsAnimated.map((propDef) => {
      const { prop, details } = propDef;
      const existing = cssAnimatedProperties.getProperty(prop);
      // const parsed = normaliseAnimatable(propDef); // TODO: Not used?
      if (!existing) {
        return notMatched(propDef);
      }
      if (existing.types && !isEqualArray(existing.types, details.types)) {
        compareLog('--MISMATCHED TYPES--', existing, details);
        return notMatched(propDef);
      }
      if (existing.properties && !isEqualArray(existing.properties, details.properties)) {
        // If the spec parser found a value type, but the existing data has properties
        if (details.types) {
          compareLog('--MISMATCHED STRUCTURE (TYPES vs SHORTHAND)--', existing, details);
          return notMatched(propDef);
        }
        // If the spec-parsed properties are missing, assume they're the same as existing ones
        if (!details.properties || !details.properties.length) {
          compareLog('--NO PARSED SHORTHAND PROPERTIES--', existing, details);
          return matched(propDef);
        }
        // TODO: Check result of compareShorthands, see if any are new
        return notMatched(propDef);
      }
      return matched(propDef);
    });

    const different = normalised.filter(p => !p.isMatch);
    log.debug('DIFFERENT', different);
    if (different.length) {
      if (!headerShown) {
        console.log(chalk.yellow(chalk`\n----- NEW ANIMATABLE: {black.bgYellow  REVIEW CAREFULLY } -----\n`));
        headerShown = true;
      }
      console.log(chalk.gray(`// ${spec.title}: ${spec.url}`));
      formatAnimatable(different);
      console.log();
    }
  });
}


/*** PARSING ***/

function collectSpecUrls() {
  const url = 'http://localhost:8080/test-current-work.html';
  return findSpecs.findAll({ url }).then(function (specList) {
    return specList.map(spec => spec.url);
  });
}

function parseAllSpecs(urlList) {
  log.debug(urlList);
  async.map(urlList, function (url, done) {
    specParser.parseUrl(url).then(function (props) {
      done(null, props);
    }, function (err) {
      done(err);
    });
  }, function (err, results) {
    log.debug('DONE', err, results && results.length);
    log.debug(results);
    if (!err) {
      process.nextTick(() => {
        log.debug(chalk.bold('\n----- PROCESS -----'));
        compareShorthands(results);
        compareAnimatable(results);
      });
    }
  });
}

/* Full run: *\/
collectSpecUrls().then(parseAllSpecs);
/* */

/* Debug: */
// const debugSpecs = ['css-align', 'css-backgrounds', 'css-color-3', 'css-flexbox', 'css-fonts', 'css-grid', 'css-images', 'css-shapes'];
// const debugSpecs = ['css-backgrounds', 'css-flexbox', 'css-grid'];
// const debugSpecs = ['css-backgrounds', 'css-flexbox'];
const debugSpecs = ['css-flexbox', 'css-grid'];
// const debugSpecs = ['css-flexbox'];
const debugUrls = debugSpecs.map(spec => `http://localhost:8080/${spec}/Overview.html`);
parseAllSpecs(debugUrls);
/* */
