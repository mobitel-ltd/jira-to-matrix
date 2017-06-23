const Polyglot = require('node-polyglot')
const conf = require('../config')

const lang = require(`./${conf.lang}`) // eslint-disable-line import/no-dynamic-require

const p = new Polyglot({
    phrases: lang.dict,
    locale: conf.lang,
})

function t(key, values, ...args) {
    const newValues = lang.tValues ? lang.tValues(values, ...args) : values
    return p.t(key, newValues)
}

module.exports.t = t
