const R = require('ramda')
const shortid = require('shortid')

const propIn = R.curry((prop, arr, obj) =>
  R.or(arr, [])
    .includes(R.or(obj, {})[prop])
)

const nonEmptyString = R.both(
  R.is(String),
  R.complement(R.isEmpty)
)

const replacePathWith = R.curry((path, replacer, obj) => {
    const NA = shortid.generate()
    const value = R.pathOr(NA, path, obj)
    if (value === NA) {
        return obj
    }
    return R.set(R.lensPath(path), replacer(value), obj)
})

module.exports = {
    propIn,
    nonEmptyString,
    replacePathWith,
}
