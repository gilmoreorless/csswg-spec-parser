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


/*** ANIMATABLE ***/

function normaliseAnimatable(propDef, parsedShorthands) {
  let clone = _.clone(propDef.details);
  if (!clone.properties || clone.properties.length > 0) {
    return clone;
  }

  const existingLonghands = cssShorthandProperties.expand(propDef.prop).filter(p => p !== propDef.prop);
  const parsedShorthand = parsedShorthands.find(_.matchesProperty('prop', propDef.prop));
  const parsedLonghands = parsedShorthand ? parsedShorthand.longhand : [];
  log.debug('(normaliseAnimatable)', propDef, existingLonghands, parsedLonghands);
  
  clone.properties = existingLonghands.length ? existingLonghands : parsedLonghands;
  return clone;
}

// Very naive stringification, designed specifically for the known keys of this parser
function formatKeyValPairs(obj) {
  let parts = [];
  const toString = (value) => JSON.stringify(value).replace(/"/g, "'");
  const valueString = (value) => {
    if (Array.isArray(value)) {
      return '[' + value.map(toString).join(', ') + ']';
    }
    return toString(value);
  };

  for (let [key, value] of Object.entries(obj)) {
    parts.push(key + ': ' + valueString(value));
  }
  return '{' + parts.join(', ') + '}';
}

function formatAnimatable(propDefs) {
  const maxLen = Math.max(...propDefs.map(pd => pd.prop.length));
  const space = (str) => Array(maxLen - str.length).fill(' ').join('');
  propDefs.forEach((pd) => {
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

  function normaliseAll(animatableProps, shorthandProps) {
    return animatableProps.map((propDef) => {
      const { prop } = propDef;
      const existing = cssAnimatedProperties.getProperty(prop);
      const parsed = normaliseAnimatable(propDef, shorthandProps);
      const parsedPropDef = Object.assign({}, propDef, { details: parsed });
      if (!existing) {
        return notMatched(parsedPropDef);
      }
      if (existing.types && !isEqualArray(existing.types, parsed.types)) {
        compareLog('--MISMATCHED TYPES--', existing, parsed);
        return notMatched(parsedPropDef);
      }
      if (existing.properties && !isEqualArray(existing.properties, parsed.properties)) {
        // If the spec parser found a value type, but the existing data has properties
        if (parsed.types) {
          compareLog('--MISMATCHED STRUCTURE (TYPES vs SHORTHAND)--', existing, parsed);
          return notMatched(parsedPropDef);
        }
        // If the spec-parsed properties are missing, assume they're the same as existing ones
        if (!parsed.properties || !parsed.properties.length) {
          compareLog('--NO PARSED SHORTHAND PROPERTIES--', existing, parsed);
          return matched(parsedPropDef);
        }
        return notMatched(parsedPropDef);
      }
      return matched(propDef);
    });
  }

  specs.forEach((spec) => {
    // Categorise the list of parsed properties based on whether they match the existing animatable data
    const normalised = normaliseAll(spec.propsAnimated, spec.propsShorthand);

    // Work with only the non-matching properties
    let different = normalised.filter(p => !p.isMatch).map(p => p.propDef);
    log.debug('DIFFERENT', different);
    if (!different.length) {
      return;
    }

    const animatableProps = new Set(normalised.map(p => p.propDef.prop));
    // Loop through animatable shorthand properties to remove longhands that are not animatable
    let dataHasChanged = true;
    while (dataHasChanged) {
      log.debug(chalk.bgBlack.white('\n-- dataHasChanged loop --'));
      dataHasChanged = false;
      // Remove longhands that are not animatable
      different.forEach((propDef) => {
        if (propDef.details.properties) {
          let oldProps = propDef.details.properties;
          let filteredProps = oldProps.filter(prop => animatableProps.has(prop));
          if (!isEqualArray(oldProps, filteredProps)) {
            log.info(`Filtered out non-animatable props for ${chalk.bold(propDef.prop)}`);
            log.debug(oldProps, filteredProps);
            propDef.details.properties = filteredProps;
            dataHasChanged = true;
          }
        }
      });

      // Remove any properties with no longhands remaining, as they are also not animatable
      let i = 0;
      while (i < different.length) {
        let propDef = different[i];
        if (propDef.details.properties && !propDef.details.properties.length) {
          log.info(`Removed non-animatable property ${chalk.bold(propDef.prop)}`);
          different.splice(i, 1);
          animatableProps.delete(propDef.prop);
          dataHasChanged = true;
        } else {
          i++;
        }
      }
    }

    // Re-check if the non-matching properties are still non-matching, now that some longhands have been removed
    different = normaliseAll(different, spec.propsShorthand).filter(p => !p.isMatch).map(p => p.propDef);
    log.debug('DIFFERENT (again)', different);
    if (!different.length) {
      return;
    }

    // Log out the new/changed properties in a format that can be copy-pasted into css-animated-properties
    if (!headerShown) {
      console.log(chalk.yellow(chalk`\n----- NEW ANIMATABLE: {black.bgYellow  REVIEW CAREFULLY } -----\n`));
      headerShown = true;
    }
    console.log(chalk.gray(`// ${spec.title}: ${spec.url}`));
    formatAnimatable(different);
    console.log();
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
    if (!url.length) return null;
    specParser.parseUrl(url).then(function (props) {
      done(null, props);
    }, function (err) {
      log.warn(chalk.red(`PARSE ERROR FOR ${url}`))
      log.warn(err && err.error || err.response && err.response.error || err);
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
