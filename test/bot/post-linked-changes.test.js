const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/lib/utils.js');
const body = require('../fixtures/comment-create-4.json');
const {getPostLinkedChangesData} = require('../../src/jira-hook-parser/parse-body.js');
const postLinkedChanges = require('../../src/bot/post-linked-changes.js');
const {isPostLinkedChanges} = require('../../src/jira-hook-parser/bot-handler.js');

describe('post New Links test', () => {
    const responce = {
        type: {
            id: '1000',
            name: 'Duplicate',
            inward: 'Duplicated by',
            outward: 'Duplicates',
            self: 'http://www.example.com/jira/rest/api/2//issueLinkType/1000',
        },
        inwardIssue: {
            id: '10004',
            key: 28516,
            self: 'http://www.example.com/jira/rest/api/2/issue/PRJ-3',
            fields: {
                summary: 'BBCOM-956',
                status: {
                    iconUrl: 'http://www.example.com/jira//images/icons/statuses/open.png',
                    name: 'Open',
                },
            },
        },
        outwardIssue: {
            id: '10004L',
            key: 30137,
            self: 'http://www.example.com/jira/rest/api/2/issue/PRJ-2',
            fields: {
                summary: 'test_task_90',
                status: {
                    iconUrl: 'http://www.example.com/jira//images/icons/statuses/open.png',
                    name: 'Open',
                },
            },
        },
    };

    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal('BBCOM-1233 "POupok" теперь в статусе "Paused"', body);
        assert.equal(roomId, 'roomIdBBCOM-1150');
        const expectedHtmlBody =
            '<p>jira_test изменил(а) статус связанной задачи <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-1233">BBCOM-1233 &quot;POupok&quot;</a> на <strong>Paused</strong></p>\n';

        assert.ok(expectedHtmlBody.includes(htmlBody));
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const mclient = {sendHtmlMessage, getRoomId};

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/jira/rest/api/2/issueLink/28516`)
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issueLink/30137`)
            .reply(200, {...responce, id: 30137});
    });


    it('Get links', async () => {
        const data = getPostLinkedChangesData(body);

        const result = await postLinkedChanges({mclient, ...data});
        assert.ok(result);
    });

    it('Get empty links', () => {
        const newBody = {...body, issue: {fields: {issuelinks: []}}};
        const isLink = isPostLinkedChanges(newBody);
        assert.equal(isLink, false);
    });
});
