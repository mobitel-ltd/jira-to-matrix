const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const fivesBody = require('../fixtures/5.json');
const parsers = require('../../src/queue/parse-body.js');
const bot = require('../../src/bot');
const {getBotFunc, getParserName, getFuncAndBody} = require('../../src/queue/bot-handler.js');

describe('get-bot-data', function() {

    it('test correct firstBody parse', () => {
        const funcArr = getBotFunc(firstBody);
        const result = funcArr.map(getParserName);
        const expected = ['getPostCommentData'];
        assert.deepEqual(result, expected);

        const parsedData = result.map(element => {
            const result = parsers[element](firstBody);
            logger.debug('parsedData', result);
            return result;
        });
        const expectedData = [{ 
            issueID: '26313',
            headerText: 'jira_test добавил(а) комментарий',
            comment: { 
                body: '12345', 
                id: '31039', 
            },
            author: 'jira_test' 
        }];

        assert.deepEqual(parsedData, expectedData);
    });

    it('test correct objects', () => {
        const correctBody = getFuncAndBody(firstBody);
        
        const expected = [{
            redisKey: 'postComment_1512034084304',
            funcName: 'postComment',
            data: {
                createRoomData: null,
                issueID: '26313',
                headerText: 'jira_test добавил(а) комментарий',
                comment: { 
                    body: '12345', 
                    id: '31039', 
                },
                author: 'jira_test' 
            }
        }];

        assert.deepEqual(correctBody, expected);
    });

    it('test correct secondBody parse', () => {
        const funcArr = getBotFunc(secondBody);
        const result = funcArr.map(getParserName);
        const expectedFuncs = [
            "getInviteNewMembersData",
            "getPostEpicUpdatesData",
            "getPostNewLinksData",
        ];
        assert.deepEqual(result, expectedFuncs);

        const parsedData = result.map(element => {
            const result = parsers[element](secondBody);
            logger.debug(`parsedData ${element}`, result);
            return result;
        });
        const expectedData = [
            {
                "issue": {
                    "collectParticipantsBody": [
                        "jira_test",
                        "jira_test",
                        "jira_test",
                    ],
                    "key": "BBCOM-956",
                    "url": "https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-956/watchers",
                },
            },
            {
                "data": {
                    "changelog": undefined,
                    "id": "26313",
                    "key": "BBCOM-956",
                    "name": "jira_test",
                    "summary": "BBCOM-956",
                },
                "epicKey": "BBCOM-801",
            },
            {
                "links": [],
            }];

        assert.deepEqual(parsedData, expectedData);
    });
});
