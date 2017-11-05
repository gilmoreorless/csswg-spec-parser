const _ = require('lodash');
const chalk = require('chalk');

const { getPage, getText } = require('./page-utils');
const rawAnimationTypes = require('css-animated-properties').types;
const cssShorthandProps = require('css-shorthand-properties');
const { log } = require('./logger');

const animationTypes = Object.entries(rawAnimationTypes).map(([key, defs]) => [defs.name, key]);

function getProperties(elem) {
  return _.uniq([].map.call(elem.querySelectorAll('.property, [data-link-type="propdesc"]'), (propElem) =>
    getText(propElem).replace(/[<>‘’]/g, '')
  ));
}

function getLonghandProps(shorthandProp, syntaxElem, descElem) {
  const existingProps = cssShorthandProps.shorthandProperties[shorthandProp];
  const syntaxProps = getProperties(syntaxElem);
  const descProps = getProperties(descElem).filter(p => p !== shorthandProp);
  const unionProps = _.union(syntaxProps, descProps);
  if (!existingProps || !existingProps.length) {
    const formatProps = (p) => {
      if (Array.isArray(p)) {
        return `[${p.join(', ')}] (${p.length})`;
      }
      return p;
    };
    log.debug(chalk.yellow('getLonghandProps - new data!', shorthandProp));
    log.debug(chalk.red(formatProps(existingProps)));
    log.debug(chalk.magenta(formatProps(syntaxProps)));
    log.debug(chalk.cyan(formatProps(descProps)));
    log.debug(chalk.black.bgGreen(formatProps(unionProps)));
    return unionProps;
  }
  return cssShorthandProps.expand(shorthandProp);
}

// TODO: Smarter parsing of animation type values. Use regex and flag deviations from the pattern
// (e.g. grid-template-columns, shape-outside)
function getAnimationType(elem) {
  let details = { types: [] };
  const text = getText(elem);
  if (~text.indexOf('repeatable list')) {
    details.repeatable = true;
  }
  if (~text.indexOf('simple list')) {
    details.multiple = true;
  }
  let hasLpc = false;
  animationTypes.forEach(([name, key]) => {
    if (~text.indexOf(name)) {
      details.types.push(key);
      if (key === 'length-percentage-calc') {
        hasLpc = true;
      }
    }
  });
  // Special case: De-duplicate type arrays of ['length', 'percentage', 'length-percentage-calc']
  if (hasLpc) {
    details.types = details.types.filter(type => type !== 'length' && type !== 'percentage');
  }
  return details;
}

exports.parseUrl = function (url) {
  console.log('parseUrl', url);
  return getPage(url).then(function (page) {
    return Object.assign({ url }, exports.parsePage(page));
  });
};

exports.parsePage = function (page) {
  const { document } = page;
  console.log('parsePage', document.title);
  let data = {
    title: getText(document.querySelector('h1'))
  };

  let propsShort = [];
  let propsAnim = [];
  const shorthandText = 'see individual properties';

  function addProp(name, isShorthand, isAnimatable) {
    name.split(',').map(p => p.trim()).forEach((prop) => {
      if (isShorthand) {
        propsShort.push({ prop, longhand: getLonghandProps(prop, ...isShorthand) });
        propsAnim.push({ prop, details: { properties: [] } });
      }
      if (isAnimatable) {
        propsAnim.push({ prop, details: isAnimatable });
      }
    });
  }

  [].forEach.call(document.querySelectorAll('table.propdef'), (table) => {
    let name = '';
    let syntaxElem = null;
    let shorthand = false, animatable = false;
    [].forEach.call(table.querySelectorAll('tr'), (tr) => {
      const key = getText(tr.children[0]).toLowerCase().replace(':', '');
      const value = getText(tr.children[1]).toLowerCase();
      switch (key) {
        case 'name':
          name = value;
          break;
        case 'value':
          syntaxElem = tr.children[1];
          break;
        case 'computed value':
          if (value === shorthandText) {
            shorthand = [syntaxElem, table.nextElementSibling];
          }
          break;
        case 'animatable':
        case 'animation type':
          if (shorthand || value === shorthandText) {
            break;
          }
          if (value !== 'no' && value !== 'discrete') {
            animatable = getAnimationType(tr.children[1]);
          }
          break;
      }
    });
    // if (shorthand) {
    //   console.log([name, syntax, getText(table.nextElementSibling)]);
    // }
    if (shorthand || animatable) {
      addProp(name, shorthand, animatable);
    }
  });

  data.propsShorthand = propsShort;
  data.propsAnimated = propsAnim;

  return data;
};
