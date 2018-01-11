const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/create.json');
const parsers = require('../../src/queue/parse-body.js');
const bot = require('../../src/bot');
const {getBotFunc, getParserName, getFuncAndBody, isCommentEvent} = require('../../src/queue/bot-handler.js');
const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');

const getRedisKeys = async () => {
    const keys = await redis.keysAsync(`${prefix}*`);

    return keys.reduce((acc, key) => {
        if (key.indexOf('|') > 0) {
            return acc;
        }
        return (key.indexOf('room') > 0 )
            ? ({...acc, roomKeys: [...acc.roomKeys, key]})
            : ({...acc, funcKeys: [...acc.funcKeys, key]});
    }, {roomKeys: [], funcKeys: []});
}

const getDataFromRedis = async allKeys => {
    const result = await Promise.all(allKeys.map(async key => {
        const newKey = key.replace(prefix, '');
        logger.debug('key in map', newKey);

        const redisValue = await redis.getAsync(newKey);
        const parsedRedisValue = JSON.parse(redisValue);
        const result = {redisKey: newKey, ...parsedRedisValue};

        return result;
    }));
}

describe('get-bot-data', function() {
    const expectedFuncKeys = [
        "test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225",
        "test-jira-hooks:postProjectUpdates_2018-1-11 13:08:04,225",
    ];

    const expectedData = [{
        redisKey: 'postEpicUpdates_2018-1-11 13:08:04,225',
        funcName: 'postEpicUpdates',
        data: {
            epicKey: 'BBCOM-801',
            data: {
                key: 'BBCOM-1398',
                summary: 'Test',
                id: '30369',
                name: 'jira_test',
                status: null
            },
        }
    },
        {
            redisKey: 'postProjectUpdates_2018-1-11 13:08:04,225',
            funcName: 'postProjectUpdates',
            data: {
                typeEvent: 'issue_created',
                projectOpts:
                    {
                        self: 'https://jira.bingo-boom.ru/jira/rest/api/2/project/10305',
                        id: '10305',
                        key: 'BBCOM',
                        name: 'BB Common',
                        avatarUrls:
                            {
                                '48x48': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?pid=10305&avatarId=10011',
                                '24x24': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=small&pid=10305&avatarId=10011',
                                '16x16': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=xsmall&pid=10305&avatarId=10011',
                                '32x32': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=medium&pid=10305&avatarId=10011'
                            }
                    },
                data:
                    {
                        key: 'BBCOM-1398',
                        summary: 'Test',
                        name: 'jira_test',
                        status: 'Open'
                    },
            }
        }];

    const expectedRoomRedisKey = 'test-jira-hooks:rooms';
    const expectedRoom = [{
        key: 'BBCOM-1398',
        createRoomData: {
            issue: {
                key: 'BBCOM-1398',
                id: '30369',
                collectParticipantsBody: [ 'jira_test', 'jira_test', 'jira_test' ],
                url: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-1398/watchers',
                summary: 'Test',
                descriptionFields: {
                    assigneeName: 'jira_test',
                    assigneeEmail: 'jira_test@bingo-boom.ru',
                    reporterName: 'jira_test',
                    reporterEmail: 'jira_test@bingo-boom.ru',
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info'
                }
            },
            webhookEvent: 'jira:issue_created'
        }
    }];


    it('test correct firstBody parse', async () => {
        const parsedForQueue = await getParsedAndSaveToRedis(JSONbody);

        logger.debug('parsedForQueue', parsedForQueue);
        assert.ok(parsedForQueue);

        const redisKeys = await getRedisKeys();
        logger.debug('redisKeys', redisKeys);

        const {roomKeys, funcKeys} = await getRedisKeys(redisKeys);

        assert.deepEqual(funcKeys, expectedFuncKeys);
        assert.deepEqual(roomKeys, expectedRoom);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');
        logger.debug('keys', keys);
        logger.debug('prefix', prefix);

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            logger.debug('parsedKeys', parsedKeys);
            await redis.delAsync(parsedKeys);
        }
    });
});
