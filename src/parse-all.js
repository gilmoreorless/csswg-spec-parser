const chalk = require('chalk');
const pMap = require('p-map');

const findSpecs = require('./find-specs');
const specParser = require('./spec-parser');
const { compareAnimatable } = require('./process-animatable');
const { compareShorthands } = require('./process-shorthands');
const { log } = require('./logger');

const USE_LOCAL_TESTING = false;

const localUrls = {
  'https://www.w3.org/TR/compositing-1/': '',
  'https://www.w3.org/TR/css-break-3': 'http://localhost:8080/css-break-3/Overview.html',
  'https://www.w3.org/TR/css-cascade-4': 'http://localhost:8080/css-cascade-4/Overview.html',
  'https://www.w3.org/TR/css-contain-1/': 'http://localhost:8080/css-contain-1/Overview.html',
  'https://www.w3.org/TR/css-counter-styles-3/': 'http://localhost:8080/css-counter-styles-3/Overview.html',
  'https://www.w3.org/TR/css-flexbox-1/': 'http://localhost:8080/css-flexbox-1/Overview.html',
  'https://www.w3.org/TR/css-grid-1': 'http://localhost:8080/css-grid-1/Overview.html',
  'https://www.w3.org/TR/css-masking/': '',
  'https://www.w3.org/TR/css-scroll-snap-1': 'http://localhost:8080/css-scroll-snap-1/Overview.html',
  'https://www.w3.org/TR/css-shapes-1/': 'http://localhost:8080/css-shapes-1/Overview.html',
  'https://www.w3.org/TR/css-style-attr': 'http://localhost:8080/css-style-attr-1/Overview.html',
  'https://www.w3.org/TR/css-text-decor-3/': 'http://localhost:8080/css-text-decor-3/Overview.html',
  'https://www.w3.org/TR/css-variables/': 'http://localhost:8080/css-variables/Overview.html',
  'https://www.w3.org/TR/css-will-change-1/': 'http://localhost:8080/css-will-change-1/Overview.html',
  'https://www.w3.org/TR/css3-background': 'http://localhost:8080/css-backgrounds-3/Overview.html',
  'https://www.w3.org/TR/css3-cascade': 'http://localhost:8080/css-cascade-3/Overview.html',
  'https://www.w3.org/TR/css3-color/': 'http://localhost:8080/css-color-3/Overview.html',
  'https://www.w3.org/TR/css3-conditional': 'http://localhost:8080/css-conditional-3/Overview.html',
  'https://www.w3.org/TR/css3-fonts': 'http://localhost:8080/css-fonts-3/Overview.html',
  'https://www.w3.org/TR/css3-images': 'http://localhost:8080/css-images-3/Overview.html',
  'https://www.w3.org/TR/css3-mediaqueries': 'http://localhost:8080/mediaqueries-3/Overview.html',
  'https://www.w3.org/TR/css3-multicol/': 'http://localhost:8080/css-multicol-1/Overview.html',
  'https://www.w3.org/TR/css3-namespace/': 'http://localhost:8080/css-namespaces/Overview.html',
  'https://www.w3.org/TR/css3-speech': 'http://localhost:8080/css-speech-1/Overview.html',
  'https://www.w3.org/TR/css3-syntax': 'http://localhost:8080/css-syntax-3/Overview.html',
  'https://www.w3.org/TR/css3-ui': 'http://localhost:8080/css-ui-3/Overview.html',
  'https://www.w3.org/TR/css3-values/': 'http://localhost:8080/css-values-3/Overview.html',
  'https://www.w3.org/TR/css3-writing-modes': 'http://localhost:8080/css-writing-modes-3/Overview.html',
  'https://www.w3.org/TR/mediaqueries-4/': 'http://localhost:8080/mediaqueries-4/Overview.html',
  'https://www.w3.org/TR/geometry-1': '',
  'https://www.w3.org/TR/selectors/': 'http://localhost:8080/selectors-3/Overview.html',
};

async function collectSpecUrls() {
  const url = USE_LOCAL_TESTING ?
    'http://localhost:8080/test-current-work.html' :
    'https://www.w3.org/Style/CSS/current-work';
  try {
    let specList = (await findSpecs.findAll({ url }))
    return specList.map(spec => {
      let { url } = spec;
      if (url.charAt(0) === '/') {
        url = 'https://www.w3.org' + url;
      }
      if (USE_LOCAL_TESTING && url in localUrls) {
        return localUrls[url];
      }
      return url;
    });
  } catch (err) {
    log.warn(chalk.red(`PARSE ERROR WHEN COLLECTING SPEC URLS FROM ${url}`));
    log.warn(err && err.error || err.response && err.response.error || err);
    return [];
  }
}

async function parseAllSpecs(urlList) {
  log.debug(urlList);
  let parseSpec = async function (url) {
    try {
      return await specParser.parseUrl(url)
    } catch (err) {
      log.warn(chalk.red(`PARSE ERROR FOR ${url}`))
      log.warn(err && err.error || err.response && err.response.error || err);
      return null;
    }
  };
  let results = await pMap(urlList, parseSpec, { concurrency: 3 });
  log.debug('DONE', results && results.length);
  log.debug(results);
  log.debug(chalk.bold('\n----- PROCESS -----'));
  compareShorthands(results);
  compareAnimatable(results);
}

/* Full run: */
(async function () {
  let urls = (await collectSpecUrls()).filter(url => url && !url.includes('CSS2'));
  parseAllSpecs(urls);
})();
/* */

/* Debug: *\/
// const debugSpecs = ['css-align', 'css-backgrounds-3', 'css-color-3', 'css-flexbox', 'css-fonts-3', 'css-grid', 'css-images', 'css-shapes'];
// const debugSpecs = ['css-backgrounds', 'css-flexbox', 'css-grid'];
// const debugSpecs = ['css-backgrounds', 'css-flexbox'];
// const debugSpecs = ['css-align', 'css-flexbox', 'css-grid'];
const debugSpecs = ['css-align-3'];
const debugUrls = debugSpecs.map(spec => `http://localhost:8080/${spec}/Overview.html`);
parseAllSpecs(debugUrls);
/* */

/**
 * TODO:
 * 
 * - TypeScript/Flow? (Would help with keeping track of data shapes)
 */
