// const nock = require('nock');
// const {stub} = require('sinon');
// const sinonChai = require('sinon-chai');
// const chai = require('chai');
// const {auth} = require('../../src/jira/common');
// const JSONbody = require('../fixtures/create.json');
// const issueBody = require('../fixtures/response.json');
// const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
// const proxyquire = require('proxyquire');

// const postProjectUpdatesStub = stub();
// const postEpicUpdatesStub = stub();
// const {getDataFromRedis, getRedisRooms, getRedisKeys, handleRedisRooms, handleRedisData} = proxyquire('../../src/queue/redis-data-handle.js', {
//     '../bot': {
//         postProjectUpdates: postProjectUpdatesStub,
//         postEpicUpdates: postEpicUpdatesStub,
//     },
// });
// const {prefix} = require('../fixtures/config.js').redis;
// const redis = require('../../src/redis-client.js');

// const {expect} = chai;
// chai.use(sinonChai);

// describe('Test getParsedAndSaveToRedis to be wired with redis handling', () => {
//     const expectedFuncKeys = [
//         'test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225',
//         'test-jira-hooks:postProjectUpdates_2018-1-11 13:08:04,225',
//     ];

//     const expectedData = [
//         {
//             redisKey: 'postProjectUpdates_2018-1-11 13:08:04,225',
//             funcName: 'postProjectUpdates',
//             data: {
//                 typeEvent: 'issue_created',
//                 projectOpts:
//                     {
//                         self: 'https://jira.bingo-boom.ru/jira/rest/api/2/project/10305',
//                         id: '10305',
//                         key: 'BBCOM',
//                         name: 'BB Common',
//                         avatarUrls:
//                             {
//                                 '48x48': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?pid=10305&avatarId=10011',
//                                 '24x24': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=small&pid=10305&avatarId=10011',
//                                 '16x16': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=xsmall&pid=10305&avatarId=10011',
//                                 '32x32': 'https://jira.bingo-boom.ru/jira/secure/projectavatar?size=medium&pid=10305&avatarId=10011',
//                             },
//                     },
//                 data:
//                     {
//                         key: 'BBCOM-1398',
//                         summary: 'Test',
//                         name: 'jira_test',
//                         status: 'Open',
//                     },
//             },
//         },
//         {
//             redisKey: 'postEpicUpdates_2018-1-11 13:08:04,225',
//             funcName: 'postEpicUpdates',
//             data: {
//                 epicKey: 'BBCOM-801',
//                 data: {
//                     key: 'BBCOM-1398',
//                     summary: 'Test',
//                     id: '30369',
//                     name: 'jira_test',
//                     status: null,
//                 },
//             },
//         },
//     ];

//     const expectedRoom = [
//         {
//             issue: {
//                 key: 'BBCOM-1398',
//                 id: '30369',
//                 collectParticipantsBody: ['jira_test', 'jira_test', 'jira_test'],
//                 url: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-1398/watchers',
//                 summary: 'Test',
//                 descriptionFields: {
//                     assigneeName: 'jira_test',
//                     assigneeEmail: 'jira_test@bingo-boom.ru',
//                     reporterName: 'jira_test',
//                     reporterEmail: 'jira_test@bingo-boom.ru',
//                     typeName: 'Task',
//                     epicLink: 'BBCOM-801',
//                     estimateTime: '1h',
//                     description: 'Info',
//                     priority: 'Medium',
//                 },
//             },
//             webhookEvent: 'jira:issue_created',
//         },
//     ];

//     const responce = {
//         id: '10002',
//         self: 'http://www.example.com/jira/rest/api/2/issue/10002',
//         key: 'EpicKey',
//         fields: {
//             summary: 'SummaryKey',
//         },
//     };

//     // const epicResponse = {
//     //     id: '10002',
//     //     self: 'http://www.example.com/jira/rest/api/2/issue/1000122',
//     //     key: 'EX-1',
//     //     fields: {
//     //         summary: 'SummaryKey',
//     //     },
//     // };

//     before(async () => {
//         nock('https://jira.bingo-boom.ru', {reqheaders: {Authorization: auth()}})
//             .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
//             .reply(200, {...responce, id: 28516})
//             .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
//             .reply(200, issueBody)
//             .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
//             .reply(200, issueBody)
//             .get(url => url.indexOf('null') > 0)
//             .reply(404);

//         await getParsedAndSaveToRedis(JSONbody);
//     });

//     it('test correct redisKeys', async () => {
//         const redisKeys = await getRedisKeys();
//         expect(redisKeys).to.have.all.members(expectedFuncKeys);
//     });

//     it('test correct dataFromRedis', async () => {
//         const dataFromRedis = await getDataFromRedis();
//         expect(dataFromRedis).to.have.deep.members(expectedData);
//     });

//     it('test correct roomsKeys', async () => {
//         const roomsKeys = await getRedisRooms();
//         expect(roomsKeys).to.have.deep.members(expectedRoom);
//     });

//     it('test correct roomsKeys', async () => {
//         const roomsKeys = await getRedisRooms();
//         expect(roomsKeys).to.have.deep.members(expectedRoom);
//     });
//     after(async () => {
//         postProjectUpdatesStub.restore();
//         postEpicUpdatesStub.restore();
//         const keys = await redis.keysAsync('*');

//         if (keys.length > 0) {
//             const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
//             await redis.delAsync(parsedKeys);
//         }
//     });
// });
