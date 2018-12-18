// const nock = require('nock');
// const {expect} = require('chai');
// const assert = require('assert');
// const {auth} = require('../../src/lib/utils.js');
// const body = require('../fixtures/comment-create-4.json');
// const {getPostNewLinksData} = require('../../src/jira-hook-parser/parse-body.js');
// const postNewLinks = require('../../src/bot/post-new-links.js');
// const {isPostNewLinks} = require('../../src/jira-hook-parser/bot-handler.js');
// const redis = require('../../src/redis-client.js');
// const {redis: {prefix}} = require('../fixtures/config.js');

// describe('post New Links test', () => {
//     const responce = {
//         type: {
//             id: '1000',
//             name: 'Duplicate',
//             inward: 'Duplicated by',
//             outward: 'Duplicates',
//             self: 'http://www.example.com/jira/rest/api/2//issueLinkType/1000',
//         },
//         inwardIssue: {
//             id: '10004',
//             key: 28516,
//             self: 'http://www.example.com/jira/rest/api/2/issue/PRJ-3',
//             fields: {
//                 summary: 'BBCOM-956',
//                 status: {
//                     iconUrl: 'http://www.example.com/jira//images/icons/statuses/open.png',
//                     name: 'Open',
//                 },
//             },
//         },
//         outwardIssue: {
//             id: '10004L',
//             key: 30137,
//             self: 'http://www.example.com/jira/rest/api/2/issue/PRJ-2',
//             fields: {
//                 summary: 'test_task_90',
//                 status: {
//                     iconUrl: 'http://www.example.com/jira//images/icons/statuses/open.png',
//                     name: 'Open',
//                 },
//             },
//         },
//     };

//     const sendHtmlMessage = (roomId, body, htmlBody) => {
//         assert.ok(['roomId28516', 'roomId30137'].includes(roomId));
//         assert.equal('Новый линк', body);
//         const expectedHtmlBody = [
//             '<p>Новая связь, эта задача <strong>Duplicates</strong> <a href="https://jira.test-example.ru/jira/browse/30137">30137 &quot;test_task_90&quot;</a></p>\n',
//             '<p>Новая связь, эта задача <strong>Duplicates</strong> <a href="https://jira.test-example.ru/jira/browse/30137">30137 &quot;test_task_90&quot;</a></p>\n',
//             '<p>Новая связь, эта задача <strong>Duplicated by</strong> <a href="https://jira.test-example.ru/jira/browse/28516">28516 &quot;BBCOM-956&quot;</a></p>\n',
//             '<p>Новая связь, эта задача <strong>Duplicated by</strong> <a href="https://jira.test-example.ru/jira/browse/28516">28516 &quot;BBCOM-956&quot;</a></p>\n',
//         ];

//         assert.ok(expectedHtmlBody.includes(htmlBody));
//         return true;
//     };
//     const getRoomId = id => `roomId${id}`;
//     const mclient = {sendHtmlMessage, getRoomId};

//     before(() => {
//         nock('https://jira.test-example.ru', {
//             reqheaders: {
//                 Authorization: auth(),
//             },
//         })
//             .get(`/jira/rest/api/2/issueLink/28516`)
//             .times(2)
//             .reply(200, {...responce, id: 28516})
//             .get(`/jira/rest/api/2/issueLink/30137`)
//             .times(2)
//             .reply(200, {...responce, id: 30137});
//     });


//     it('Get links', async () => {
//         const {links} = getPostNewLinksData(body);

//         const result = await postNewLinks({mclient, links});
//         assert.ok(result);
//     });

//     it('Handle links', async () => {
//         const links = [
//             '28516',
//             '30137',
//             '26500',
//         ];
//         try {
//             await postNewLinks({mclient, links});
//         } catch (error) {
//             expect(error).to.be.ok;
//         }
//     });

//     it('Get empty links', async () => {
//         body.issue.fields.issueLinks = [];
//         const newBody = {...body, issue: {fields: {issuelinks: []}}};
//         const isLink = isPostNewLinks(newBody);
//         assert.equal(isLink, false);

//         const {links} = getPostNewLinksData(newBody);
//         assert.deepEqual(links, []);

//         const result = await postNewLinks({mclient, links});
//         assert.ok(result);
//     });

//     after(async () => {
//         const keys = await redis.keysAsync('*');

//         if (keys.length > 0) {
//             const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
//             await redis.delAsync(parsedKeys);
//         }
//     });
// });
