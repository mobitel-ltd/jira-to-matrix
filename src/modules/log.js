const path = require('path');
const winston = require('winston');
const WinstonDailyRotateFile = require('winston-daily-rotate-file');
const configPath = path.resolve('./', process.env.NODE_ENV === 'test' ? 'test/fixtures' : '', 'config.js');
const config = require(configPath);

/**
 * Customize logger timestamp format to locale datetime with milliseconds
 * @returns {string} Formatted datetime string
 */
const timestamp = () => {
    const datetime = new Date();
    const ms = String(datetime.getMilliseconds() % 1000);
    return `${datetime.toLocaleString()},${ms.padEnd(3, 0)}`;
};

/**
 * Customized settings for logger module "winston".
 * @module log
 * @param {Object} module Current application module.
 * @returns {{error: Function, warn: Function, info: Function, verbose: Function, debug: Function, silly: Function}}
 *     Configured logger object.
 */
const getLogger = function getLogger(module) {
    // a label with the name of the file, which displays the message
    /** @warn May be an error on unit-tests */
    let label = module.filename
        .replace(process.cwd(), '')
        .split(path.sep)
        .slice(-2)
        .join(path.sep);
    if (label[0] !== path.sep) {
        label = path.sep + label;
    }
    // specifies the transport of logs depending on the settings
    const setTransports = [];
    /** @type {{type, consoleLevel, filePath, fileLevel}} */
    const logConfig = config.log;

    // logging in console
    if (logConfig.type === 'console' || logConfig.type === 'both') {
        setTransports.push(new (winston.transports.Console)({
            label,
            timestamp,
            colorize: true,
            level: logConfig.consoleLevel,
            json: false,
            prettyPrint: true,
        }));
    }

    // logging in file
    if (logConfig.type === 'file' || logConfig.type === 'both') {
        setTransports.push(new WinstonDailyRotateFile({
            label,
            timestamp,
            filename: logConfig.filePath,
            level: logConfig.fileLevel,
            json: true,
        }));
    }

    // return customized logger
    return new (winston.Logger)({
        exitOnError: false,
        transports: setTransports,
    });
};

module.exports = getLogger;
