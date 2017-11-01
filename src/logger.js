const chalk = require('chalk');
const util = require('util');

const logLevels = {
  WARN: 0,
  INFO: 1,
  DEBUG: 2,
};

const CURRENT_LOG_LEVEL = logLevels.WARN;

function canLog(level) {
  return logLevels[level] && CURRENT_LOG_LEVEL >= logLevels[level];
}

function logger(level) {
  return (...args) => {
    if (canLog(level)) {
      let prefix = chalk.dim(`[${level}] `);
      // Don't use util.inspect if any string contains escape sequences (i.e. strings from chalk)
      var hasEscape = args.some(arg => typeof arg === 'string' && arg.includes('\u001b['));
      if (hasEscape) {
        console.log(prefix, ...args);
      } else {
        console.log(prefix);
        args.forEach((arg) => {
          console.log(util.inspect(arg, {depth: null, colors: true}));
        });
      }
    }
  }
};

const log = {
  warn: logger('WARN'),
  info: logger('INFO'),
  debug: logger('DEBUG'),
};

exports.CURRENT_LOG_LEVEL = CURRENT_LOG_LEVEL;
exports.canLog = canLog;
exports.log = log;
