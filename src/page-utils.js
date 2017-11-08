const request = require('superagent');
const { JSDOM } = require('jsdom');

exports.getText = (elem) => elem.textContent.trim().replace(/\s{2,}|\xA0/g, ' ');

exports.getPage = function (url) {
  return new Promise(function (resolve, reject) {
    request.get(url)
      .set('User-Agent', 'csswg-spec-parser (https://github.com/gilmoreorless/csswg-spec-parser)')
      .accept('text/html,application/xhtml+xml,application/xml')
      .end(function (err, response) {
        if (err) {
          return reject(err);
        }
        const dom = new JSDOM(response.text);
        resolve(dom.window);
      });
  });
};
