const path = require('path');
const winston = require('winston');
const configPath = path.resolve('./', process.env.NODE_ENV === 'test' ? 'test/fixtures' : '', 'config.js');
const { log: logConfig } = require(configPath);

/**
 * Customize logger timestamp format to locale datetime with milliseconds
 * @returns {string} Formatted datetime string
 */
const timestamp = () => {
    const datetime = new Date();
    const ms = String(datetime.getMilliseconds() % 1000);
    return `${datetime.toLocaleString()},${ms.padEnd(3, 0)}`;
};

const getLabel = mod => {
    if (typeof mod === 'string') {
        return mod;
    }
    const label = mod.filename
        .replace(process.cwd(), '')
        .split(path.sep)
        .slice(-2)
        .join(path.sep);

    return label[0] === path.sep ? label : path.sep + label;
};

const getTransports = data => {
    const baseTransport = { label: getLabel(data), timestamp };

    const fileTransport = new winston.transports.File({
        ...baseTransport,
        filename: logConfig.filePath,
        level: logConfig.fileLevel,
        json: true,
    });

    const consoleTransport = new winston.transports.Console({
        ...baseTransport,
        colorize: true,
        level: logConfig.consoleLevel,
        json: false,
        prettyPrint: true,
        silent: process.env.NODE_ENV === 'test',
    });

    const levels = {
        file: [fileTransport],
        console: [consoleTransport],
        both: [fileTransport, consoleTransport],
    };

    return levels[logConfig.type];
};

/**
 * Customized settings for logger module "winston".
 * @module log
 * @param {Object} data Current application module.
 * @returns {{error: Function, warn: Function, info: Function, verbose: Function, debug: Function, silly: Function}}
 *     Configured logger object.
 */
module.exports = data => {
    const transports = getTransports(data);

    return new winston.Logger({
        exitOnError: false,
        transports,
    });
};
