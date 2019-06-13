const nock = require('nock');
const chai = require('chai');
const translate = require('../../src/locales');
const utils = require('../../src/lib/utils.js');
const issueMovedJSON = require('../fixtures/webhooks/issue/updated/move-issue.json');
const descriptionUpdateJSON = require('../fixtures/webhooks/issue/updated/description-update.json');
const {getPostIssueUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {isPostIssueUpdates} = require('../../src/jira-hook-parser/bot-handler.js');
const {postIssueUpdates} = require('../../src/bot/actions');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const sinonChai = require('sinon-chai');
const {expect} = chai;
const testUtils = require('../test-utils');
chai.use(sinonChai);

describe('Post issue updates test', () => {
    const roomId = 'roomId';
    let chatApi;

    const postIssueUpdatesData = getPostIssueUpdatesData(issueMovedJSON);
    const {displayName: userName} = issueMovedJSON.user;
    const changes =
        '<br>issuetype: Story<br>project: Internal Development<br>status: To Do<br>Workflow: Software Simplified Workflow for Project INDEV<br>Key: INDEV-130';
    const expectedData = [
        roomId,
        translate('issueHasChanged'),
        `${translate('issue_updated', {name: userName})}${changes}`,
    ];

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${utils.getKey(descriptionUpdateJSON)}`)
            .times(4)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getOldKey(issueMovedJSON)}`)
            .times(4)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON);
    });

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        chatApi.getRoomId
            .resolves(roomId)
            .withArgs(null)
            .throws('Error');
    });

    after(() => {
        nock.cleanAll();
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(
            ...expectedData
        );
        expect(result).to.be.true;
    });

    it('test isPostIssueUpdates', () => {
        const result = isPostIssueUpdates(issueMovedJSON);
        expect(result).to.be.ok;
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postIssueUpdatesData, oldKey: null};
        let result;
        try {
            result = await postIssueUpdates({chatApi, ...newBody});
        } catch (error) {
            result = error;
        }
        expect(result).to.be.string;
    });

    it('Get true with empty newKey', async () => {
        const newBody = {...postIssueUpdatesData, newKey: null};

        const result = await postIssueUpdates({chatApi, ...newBody});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error in postUpdateInfo', async () => {
        chatApi.sendHtmlMessage.reset();
        chatApi.sendHtmlMessage.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');

        let res;

        try {
            res = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        } catch (err) {
            res = err;
        }

        expect(res).to.deep.equal(expected);
    });

    it('Get error in move with updateRoomData', async () => {
        chatApi.updateRoomData.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');
        let res;

        try {
            res = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        } catch (err) {
            res = err;
        }
        expect(res).to.deep.equal(expected);
    });

    it('Expect no error with description changed and no new name includes', async () => {
        const data = getPostIssueUpdatesData(descriptionUpdateJSON);
        const res = await postIssueUpdates({chatApi, ...data});

        expect(res).to.be.true;
    });

    it('Expect name to be changed if only summary updated', async () => {
        const changelog = {
            'id': '52267',
            'items': [{
                'field': 'summary',
                'fieldtype': 'jira',
                'fieldId': 'summary',
                'from': null,
                'fromString': 'Тестовая задача',
                'to': null,
                'toString': 'Моя тестовая задача',
            }],
        };

        const onlySummaryUpdateJSON = {...descriptionUpdateJSON, changelog};
        const data = getPostIssueUpdatesData(onlySummaryUpdateJSON);
        const res = await postIssueUpdates({chatApi, ...data});

        expect(chatApi.updateRoomName).to.be.calledWithExactly(
            roomId,
            {key: data.oldKey, summary: changelog.items[0].toString},
        );
        expect(res).to.be.true;
    });
});
