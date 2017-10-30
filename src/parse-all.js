const _ = require('lodash');
const async = require('async');
const chalk = require('chalk');
const cssAnimatedProperties = require('css-animated-properties');
const cssShorthandProperties = require('css-shorthand-properties');
const util = require('util');

const findSpecs = require('./find-specs');
const specParser = require('./spec-parser');

const logLevels = {
  WARN: 0,
  INFO: 1,
  DEBUG: 2,
};

const CURRENT_LOG_LEVEL = logLevels.DEBUG;

const logger = (level) => {
  return (...args) => {
    if (CURRENT_LOG_LEVEL >= level) {
      // Don't use util.inspect if any string contains escape sequences (i.e. strings from chalk)
      var hasEscape = args.some(arg => typeof arg === 'string' && arg.includes('\u001b['));
      if (hasEscape) {
        console.log(...args);
      } else {
        args.forEach((arg) => {
          console.log(util.inspect(arg, {depth: null, colors: true}));
        });
      }
    }
  };
};
const log = {
  warn: logger(logLevels.WARN),
  info: logger(logLevels.INFO),
  debug: logger(logLevels.DEBUG),
};

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
        console.log('\n----- NEW SHORTHANDS: %s -----', chalk.bold('REVIEW CAREFULLY'));
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

function formatAnimatable(props) {
  // console.log('(TODO: formatAnimatable)', props);
  const maxLen = Math.max(...props.map(p => p.propDef.prop.length));
  const space = (str) => Array(maxLen - str.length).fill(' ').join('');
  props.forEach((p) => {
    let pd = p.propDef;
    console.log(
      `'${pd.prop}': ${space(pd.prop)}` +
      JSON.stringify(pd.details).replace(/"/g, "'") + // TODO: Make this better
      `,`
    );
  });
}

function compareAnimatable(specs) {
  let headerShown = false;
  const matched    = (propDef) => ({ propDef, isMatch: true });
  const notMatched = (propDef) => ({ propDef, isMatch: false });

  const compareLog = (title, existing, parsed) => {
    log.info(title);
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
        console.log('\n----- NEW ANIMATABLE: %s -----', chalk.bold('REVIEW CAREFULLY'));
        headerShown = true;
      }
      console.log(chalk.gray(`\n// ${spec.title}: ${spec.url}`));
      formatAnimatable(different);
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
        log.info('\n----- PROCESS -----');
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
