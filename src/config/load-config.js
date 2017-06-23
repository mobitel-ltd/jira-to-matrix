const R = require('ramda')
const path = require('path')
const { rootDir } = require('../constants')
const validate = require('./validate-config')
const { fp } = require('../utils')

function getConfig() {
    class Arg {
        constructor(key, alias, descr, usage, example) {
            this.fields = { key, alias, descr, usage, example }
        }

        usage() {
            const { key, usage } = this.fields
            return `-${key} ${usage}`
        }

        example() {
            const { key, example } = this.fields
            return `-${key} ${example}`
        }
    }
    const args = [
        new Arg(
            'c',
            'conf',
            'absolute or relative to app.js path to config file',
            '"path_to_config"',
            '"./config.js"'
        ),
    ]

    let argv = require('yargs') // eslint-disable-line global-require
        .usage(`Usage: node . ${args.map(arg => arg.usage()).join(' ')}`)
        .example(`node . ${args.map(arg => arg.example()).join(' ')}`)
        .demandOption(args.map(arg => arg.fields.key))
        .help('h')
        .alias('h', 'help')

    argv = args.reduce((result, arg) => {
        const { key, alias, descr } = arg.fields
        return result.describe(key, descr).alias(key, alias)
    }, argv).argv

    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(rootDir, argv.conf))
}

function getTestConfig() {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require('../../config.example')
}

function composeConfig(getConfigFn) {
    const removeTrailingSlash = R.replace(/\/$/, '')
    const config = R.pipe(
        getConfigFn,
        fp.replacePathWith(['jira', 'url'], removeTrailingSlash)
    )()
    if (!validate(config)) {
        process.exit(1)
    }

    const matrix = R.merge(config.matrix, {
        baseUrl: `https://${config.matrix.domain}`,
        userId: `@${config.matrix.user}:${config.matrix.domain}`,
    })

    const version = '2017-06-23/2'

    return R.mergeAll([config, { matrix }, { version }])
}

const config = process.env.NODE_ENV === 'test' ?
    composeConfig(getTestConfig) :
    composeConfig(getConfig)

module.exports = Object.freeze(config)
