const { getPage, getText } = require('./page-utils');

const DEFAULT_URL = 'https://www.w3.org/Style/CSS/current-work';
const DEFAULT_STATUSES = ['REC', 'PR', 'CR'];
const BLOCK_IDS = ['completed', 'stable', 'testing', 'refine'];
const EXCLUDE_NAMES = ['CSS Level 1'];

exports.findAll = function (options = {}) {
  const pageUrl = options.url || DEFAULT_URL;
  const desiredStatuses = options.statuses || DEFAULT_STATUSES;

  return getPage(pageUrl).then(function (page) {
    let specs = BLOCK_IDS.map((blockId) => {
      let block = page.document.getElementById(blockId);
      return [].map.call(block.querySelectorAll('tr'), (tr) => {
        const td = tr.children[0];
        if (td.tagName !== 'TD') return {};
        return {
          name: getText(td),
          url: td.querySelector('a').href,
          status: getText(tr.children[1])
        };
      }).filter((spec) => {
        if (!spec.name) return false;
        return desiredStatuses.includes(spec.status) && !EXCLUDE_NAMES.includes(spec.name);
      });
    }).reduce((prev, list) => prev.concat(list), []);

    // Sort by spec status, then by name
    const comparator = (a, b) => a === b ? 0 : a < b ? -1 : 1;
    const compareStatus = (a, b) =>
      comparator(desiredStatuses.indexOf(a.status), desiredStatuses.indexOf(b.status));

    specs.sort((a, b) => {
      const status = compareStatus(a, b);
      if (status !== 0) return status;
      return comparator(a.name, b.name);
    });

    return specs;
  });
};


