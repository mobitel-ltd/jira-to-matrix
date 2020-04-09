const R = require('ramda');
const logger = require('../../../modules/log.js')(module);

const EXPECTED_POWER = 100;
const NO_POWER = 'No power';
const ADMINS_EXISTS = 'admins exists';
const ALL_DELETED = 'all deleted';

const kickStates = {
    NO_POWER,
    ADMINS_EXISTS,
    ALL_DELETED,
};

/**
 * @param {{userId: string, powerLevel: number}[]} members room members
 * @param {string} botId bot user Id
 * @returns {{simpleUsers: string[], admins: string[], bot: string[]}} grouped users
 */
const getGroupedUsers = (members, botId) => {
    const getGroup = user => {
        if (user.powerLevel < EXPECTED_POWER) {
            return 'simpleUsers';
        }

        return user.userId.includes(botId) ? 'bot' : 'admins';
    };

    const res = R.pipe(R.groupBy(getGroup), R.map(R.map(R.path(['userId']))))(members);

    return {
        admins: res.admins || [],
        simpleUsers: res.simpleUsers || [],
        bot: res.bot || [],
    };
};

const hasPowerToKick = (botId, members, expectedPower) => {
    const botData = members.find(user => user.userId.includes(botId));

    return botData && botData.powerLevel === expectedPower;
};

const kick = async (chatApi, { id, members }, expectedPower = 100) => {
    if (!hasPowerToKick(chatApi.getMyId(), members, expectedPower)) {
        logger.debug(`No power for kick in room with id ${id}`);

        return NO_POWER;
    }

    const groupedData = getGroupedUsers(members, chatApi.getMyId());

    const kickedUsers = await Promise.all(
        groupedData.simpleUsers.map(async userId => {
            const res = await chatApi.kickUserByRoom({ roomId: id, userId });

            return { userId, isKicked: Boolean(res) };
        }),
    );
    const viewRes = kickedUsers.map(({ userId, isKicked }) => `${userId} ---- ${isKicked}`).join('\n');
    logger.debug(`Result of kicking users from room with id "${id}"\n${viewRes}`);

    if (groupedData.admins.length) {
        logger.debug(`Room have admins which bot cannot kick:\n ${groupedData.admins.join('\n')}`);

        return ADMINS_EXISTS;
    }

    return ALL_DELETED;
};

const parseBodyText = (bodyText = '', usingParam) => {
    const [paramData, ...rest] = bodyText.split('--');
    const param = paramData && paramData.trim();
    const optionWithParams = rest.filter(Boolean).map(el => el.trim());

    const options = optionWithParams
        .map(el => {
            const [optionName, ...optionParams] = el.split(' ').filter(Boolean);

            return {
                [optionName]: optionParams.join(' '),
            };
        })
        .reduce((acc, val) => ({ ...acc, ...val }), {});

    const has = optionName => Object.keys(options).includes(optionName);
    const get = optionName => options[optionName];

    return {
        param,
        options,
        has,
        get,
    };
};

module.exports = {
    EXPECTED_POWER,
    kickStates,
    kick,
    parseBodyText,
    getGroupedUsers,
};
