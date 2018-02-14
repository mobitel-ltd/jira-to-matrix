const nock = require('nock');
const assert = require('assert');
const {expect} = require('chai');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/create.json');
const issueBody = require('../fixtures/response.json');
const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
const {getRedisKeys, getDataFromRedis, getRedisRooms, handleRedisData, handleRedisRooms} = require('../../src/queue/redis-data-handle.js');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');

describe('get-bot-data', function() {
    const expectedFuncKeys = [
        "test-jira-hooks:postProjectUpdates_2018-1-11 13:08:04,225",
        "test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225",
    ];

    const expectedData = [
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
        },
        {
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
];

    const expectedRoom = [
        {
            issue: {
                key: 'BBCOM-1398',
                id: '30369',
                collectParticipantsBody: ['jira_test', 'jira_test', 'jira_test'],
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
                    description: 'Info',
                    priority: 'Medium',
                }
            },
            webhookEvent: 'jira:issue_created'
        }
    ];

    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EpicKey",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const epicResponse = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/1000122",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'BBCOM-1398');
        const formattedBody = body.split('\n').filter(Boolean).join('');
        const formattedhtmlBody = htmlBody.split('\n').filter(Boolean).map(el => el.trim()).join('');
        logger.debug('body', formattedBody);
        logger.debug('htmlBody', formattedhtmlBody);
        const expectedBody = [
            'Assignee: jira_test jira_test@bingo-boom.ruReporter: jira_test jira_test@bingo-boom.ruType: TaskEpic link: undefined (BBCOM-801) https://jira.bingo-boom.ru/jira/browse/BBCOM-801Estimate time: 1hDescription: Info',
            'Send tutorial'
        ];

        expect(expectedBody).to.include(formattedBody);
        const expectedHtmlBody = [
            'Assignee:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>Reporter:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>Type:<br>&nbsp;&nbsp;&nbsp;&nbsp;Task<br><br>Epic link:<br>&nbsp;&nbsp;&nbsp;&nbsp;undefined (BBCOM-801)<br>&nbsp;&nbsp;&nbsp;&nbsp;	https://jira.bingo-boom.ru/jira/browse/BBCOM-801<br><br>Estimate time:<br>&nbsp;&nbsp;&nbsp;&nbsp;1h<br><br>Description:<br>&nbsp;&nbsp;&nbsp;&nbsp;Info<br>',
            '<br>Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands',
        ];

        expect(expectedHtmlBody).to.include(formattedhtmlBody);
        return true;
    };
    const getRoomId = id => null;
    const roomCreating = options => {
        logger.debug('options', options)
        const expected = {
            room_alias_name: 'BBCOM-1398',
            invite: ['@jira_test:matrix.bingo-boom.ru'],
            name: 'BBCOM-1398 Test',
            topic: 'https://jira.bingo-boom.ru/jira/browse/BBCOM-1398'
        };

        assert.deepEqual(options, expected);
        return options.room_alias_name;
    }
    const mclient = {sendHtmlMessage, getRoomId, createRoom: roomCreating};

    before(async () => {
        nock('https://jira.bingo-boom.ru', {reqheaders: {Authorization: auth()}})
            .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
            .reply(200, issueBody)
            .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);

        await getParsedAndSaveToRedis(JSONbody);
        });

    it('test correct redisKeys', async () => {
        const redisKeys = await getRedisKeys();
        expect(redisKeys).to.have.all.members(expectedFuncKeys);
    });

    it('test correct dataFromRedis', async () => {
        const dataFromRedis = await getDataFromRedis();
        expect(dataFromRedis).to.have.deep.members(expectedData);
    });

    it('test correct roomsKeys', async () => {
        const roomsKeys = await getRedisRooms();
        expect(roomsKeys).to.have.deep.members(expectedRoom);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
