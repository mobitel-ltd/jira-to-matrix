const querystring = require('querystring');
const logger = require('debug')('get-all-users');
const {auth} = require('../jira/common');
const {fetchJSON} = require('./rest');

// Let get all users even if they are more 1000

module.exports = (async () => {
    const iter = async (num, startAt, acc) => {
        logger('acc', acc.length);
        const params = {
            username: '@boom',
            startAt,
            maxResults: num,
        };

        const queryPararms = querystring.stringify(params);

        const result = await fetchJSON(
            `https://jira.bingo-boom.ru/jira/rest/api/2/user/search?${queryPararms}`,
            auth()
        );
        const newAcc = [...acc, ...result];
        // eslint-disable-next-line
        return (result.length < num) ? newAcc : (await iter(num, startAt + num, newAcc));
    };
    // eslint-disable-next-line
    return (await iter(999, 0, []));
});
