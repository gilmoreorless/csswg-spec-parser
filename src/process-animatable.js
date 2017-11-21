const _ = require('lodash');
const chalk = require('chalk');
const cssAnimatedProperties = require('css-animated-properties');
const cssShorthandProperties = require('css-shorthand-properties');

const { log } = require('./logger');
const { isEqualArray } = require('./utils');


function normaliseLonghands(propDef, parsedShorthands) {
  let clone = _.clone(propDef.details);
  if (!clone.properties || clone.properties.length > 0) {
    return clone;
  }

  const existingLonghands = cssShorthandProperties.expand(propDef.prop).filter(p => p !== propDef.prop);
  const parsedShorthand = parsedShorthands.find(_.matchesProperty('prop', propDef.prop));
  const parsedLonghands = parsedShorthand ? parsedShorthand.longhand : [];
  log.debug('(normalise animatable longhands)', propDef, existingLonghands, parsedLonghands);
  
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
  propDefs.forEach((pd) => {
    console.log(`'${pd.prop}': ${formatKeyValPairs(pd.details)},`);
  });
}

function normaliseAnimatable(animatableProps, shorthandProps) {
  const matched    = (propDef) => ({ propDef, isMatch: true });
  const notMatched = (propDef) => ({ propDef, isMatch: false });

  const compareLog = (title, existing, parsed) => {
    log.info(chalk.bgBlack.white(title));
    log.info(chalk.bold('  Existing:'), existing);
    log.info(chalk.bold('  Parsed:'), parsed);
  };

  return animatableProps.map((propDef) => {
    const { prop } = propDef;
    const existing = cssAnimatedProperties.getProperty(prop);
    const parsed = normaliseLonghands(propDef, shorthandProps);
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

exports.compareAnimatable = function (specs) {
  let headerShown = false;

  specs.forEach((spec) => {
    if (!spec) {
      return;
    }
    // Categorise the list of parsed properties based on whether they match the existing animatable data
    const normalised = normaliseAnimatable(spec.propsAnimated, spec.propsShorthand);

    // Work with only the non-matching properties
    let different = normalised.filter(p => !p.isMatch).map(p => p.propDef);
    log.debug('DIFFERENT', different);
    if (!different.length) {
      return;
    }

    const animatableProps = new Set(
      _.keys(cssAnimatedProperties.animatedProperties).concat(
        normalised.map(p => p.propDef.prop)
      )
    );
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
    different = normaliseAnimatable(different, spec.propsShorthand).filter(p => !p.isMatch).map(p => p.propDef);
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
