const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer tentatively to the /home/nodes/n8n/.cache folder
  cacheDirectory: join(__dirname, '..', '.cache', 'puppeteer'),

  // Download Chrome (default `skipDownload: false`).
  chrome: {
    skipDownload: false,
  },
  // Download Firefox (default `skipDownload: true`).
  firefox: {
    skipDownload: false,
  },
};