const Ramda = require('ramda');
const shortid = require('shortid');

const propIn = Ramda.curry((prop, arr, obj) =>
    Ramda.or(arr, [])
        .includes(Ramda.or(obj, {})[prop])
);

const nonEmptyString = Ramda.both(
    Ramda.is(String),
    Ramda.complement(Ramda.isEmpty)
);

const replacePathWith = Ramda.curry((path, replacer, obj) => {
    const NA = shortid.generate();
    const value = Ramda.pathOr(NA, path, obj);
    if (value === NA) {
        return obj;
    }
    return Ramda.set(Ramda.lensPath(path), replacer(value), obj);
});

// eslint-disable-next-line no-shadow
const paths = Ramda.curry((paths, object) => Ramda.pipe(
    Ramda.map(Ramda.split('.')),
    Ramda.map(path => ({
        [path.join('.')]: Ramda.path(path, object),
    })),
    Ramda.mergeAll
)(paths));

module.exports = {
    propIn,
    nonEmptyString,
    replacePathWith,
    paths,
};
