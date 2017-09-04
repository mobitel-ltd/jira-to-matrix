/* eslint-disable global-require */
module.exports = Object.assign(
    require('./common'),
    {issue: require('./issue')},
    {epic: require('./epic')},
    {link: require('./link')}
);
