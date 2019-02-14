const nock = require('nock');
const chai = require('chai');
const translate = require('../../src/locales');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const {getPostIssueUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {isPostIssueUpdates} = require('../../src/jira-hook-parser/bot-handler.js');
const {postIssueUpdates} = require('../../src/bot/actions');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post issue updates test', () => {
    const matrixRoomId = 'roomId';
    const {description} = renderedIssueJSON.renderedFields;
    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
        setRoomName: stub(),
        createAlias: stub(),
        setRoomTopic: stub(),
    };

    const postIssueUpdatesData = getPostIssueUpdatesData(JSONbody);
    const {name: userName} = JSONbody.user;
    const newKey = postIssueUpdatesData.changelog.items.find(({field}) => field === 'Key').toString;
    const newStatus = postIssueUpdatesData.changelog.items.find(({field}) => field === 'status').toString;
    const expectedData = [
        matrixRoomId,
        translate('issueHasChanged'),
        `${translate('issue_updated', {name: userName})}<br>status: ${newStatus}<br>description: ${description}<br>Key: ${newKey}`,
    ];

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .get(`/issue/${JSONbody.issue.key}`)
            .times(6)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON);
    });

    beforeEach(() => {
        chatApi.getRoomId
            .resolves(matrixRoomId)
            .withArgs(null).throws('Error');
    });

    afterEach(() => {
        chatApi.getRoomId.reset();
        chatApi.createAlias.reset();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect createAlias to be with error but postIssueUpdates should work', async () => {
        chatApi.createAlias.callsFake((alias, roomId) => {
            try {
                throw new Error('M_UNKNOWN: Room alias #BAO-193:matrix.test-example.ru already exists');
            } catch (err) {
                if (err.message.includes(`Room alias #BAO-193:matrix.test-example.ru already exists`)) {
                    return null;
                }
                throw ['Error while creating alias for a room', err].join('\n');
            }
        });

        const result = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });


    it('test isPostIssueUpdates', () => {
        const result = isPostIssueUpdates(JSONbody);
        expect(result).to.be.ok;
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postIssueUpdatesData, issueKey: null};
        let result;
        try {
            result = await postIssueUpdates({chatApi, ...newBody});
        } catch (error) {
            result = error;
        }
        expect(result).to.be.string;
    });

    it('Get true with empty fieldkey', async () => {
        const newBody = {...postIssueUpdatesData, fieldKey: null};

        const result = await postIssueUpdates({chatApi, ...newBody});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get true with empty summary', async () => {
        const newBody = {...postIssueUpdatesData, summary: null};

        const result = await postIssueUpdates({chatApi, ...newBody});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error in postUpdateInfo', async () => {
        chatApi.sendHtmlMessage.reset();
        chatApi.sendHtmlMessage.throws('Error!!!');
        const expected = [
            'Error in postIssueUpdates',
            'Error in postUpdateInfo',
            'Error!!!',
        ].join('\n');

        let res;

        try {
            res = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        } catch (err) {
            res = err;
        }

        expect(res).to.deep.equal(expected);
    });

    it('Get error in move with createAlias', async () => {
        chatApi.createAlias.throws('Error!!!');
        const expected = [
            'Error in postIssueUpdates',
            'Error in move issue',
            'Error!!!',
        ].join('\n');
        let res;

        try {
            res = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        } catch (err) {
            res = err;
        }
        expect(res).to.deep.equal(expected);
    });
});
