CSS Working Group specification parser
======================================

This project parses CSS specs and generates the property definitions of the following npm modules:

* [`css-animated-properties`](https://www.npmjs.com/package/css-animated-properties)
* [`css-shorthand-properties`](https://www.npmjs.com/package/css-shorthand-properties)

### Disclaimer

The code is open source under the [MIT license](LICENSE), but with extra emphasis on the phrase “without warranty of any kind”.

The parser has been designed specifically for the modules listed above, so it is not a general-purpose spec parser.
This documentation exists almost entirely for Future Me, who will eventually thank Past Me for writing things down. If you happen to find something here that works for you, that’s cool, but don’t expect it to work for any use case but mine.


How it works
------------

Simply put, the parser:

1. Opens the W3C’s [current work][css-current-work] page for CSS specs.
2. Finds all “stable” specifications (recommendations (REC), candidate recommendations (CR), and proposed recommendations (PR)).
3. Parses each specification to find all shorthand and animatable properties.
4. Checks the found properties against the existing data, and outputs any differences.

I then copy the new data into the appropriate module repository and publish a new version.

A more detailed process is described in [PROCESS.txt](). It’s not fool-proof (hence the manual copy/paste step) — a list of problems found during this project is described in [PROBLEMS.md]().

### Setup / development

1. Make sure there’s a decent internet connection.
2. `npm install`
3. `npm run all`
4. Copy/paste data into the right module.

There are some extra tools available for development and debugging.

#### Extra logging

By default, the only output from the parser is the name/URL of the spec being parsed, and the final lists of changed data. If something doesn’t look right, extra logging can be added. The file [`src/logger.js`]() has a flag of `CURRENT_LOG_LEVEL` that can be the following values:

* `logLevels.WARN` — the default minimal logging.
* `logLevels.INFO` — extra information when eliminating parsed longhands for animatable properties.
* `logLevels.DEBUG` — full debug logging, will log as each step of the process is reached. It’s best to only turn this on when parsing a single spec page.

#### Test on local spec copies

To avoid lots of requests to W3C’s servers while debugging, it’s best to test on a local copy of the specs:

1. Clone the [`csswg-drafts`](https://github.com/w3c/csswg-drafts) repository (or update an existing clone).
2. Save a copy of the [W3C current work][css-current-work] page to `test-current-work.html` in the root of the repository.
3. From the root of the repository, run a simple HTTP server on port 8080 (Node’s [`http-server`](https://www.npmjs.com/package/http-server) module or Python’s inbuilt `SimpleHTTPServer` module will suffice).
4. In [`src/parse-all.js`](), change the `USE_LOCAL_TESTING` flag to `true`.


[css-current-work]: https://www.w3.org/Style/CSS/current-work
