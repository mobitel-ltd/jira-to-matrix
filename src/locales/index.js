const Polyglot = require('node-polyglot');
const conf = require('../config');

// eslint-disable-next-line
const lang = require(`./${conf.lang}`);

const polyglot = new Polyglot({
    phrases: lang.dict,
    locale: conf.lang,
});

module.exports = (key, values, ...args) => {
    const newValues = lang.tValues ? lang.tValues(values, ...args) : values;
    return polyglot.t(key, newValues);
};
