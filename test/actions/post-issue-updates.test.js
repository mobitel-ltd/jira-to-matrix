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
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post issue updates test', () => {
    const matrixRoomId = 'roomId';
    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
        setRoomName: stub(),
        createAlias: stub(),
        setRoomTopic: stub(),
    };

    const postIssueUpdatesData = getPostIssueUpdatesData(issueMovedJSON);
    const {name: userName} = issueMovedJSON.user;
    const changes =
        '<br>issuetype: Story<br>project: Internal Development<br>status: To Do<br>Workflow: Software Simplified Workflow for Project INDEV<br>Key: INDEV-130';
    const expectedData = [
        matrixRoomId,
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
        chatApi.getRoomId
            .resolves(matrixRoomId)
            .withArgs(null)
            .throws('Error');
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect createAlias to be with error but postIssueUpdates should work', async () => {
        chatApi.createAlias.callsFake((alias, roomId) => {
            try {
                throw new Error(
                    'M_UNKNOWN: Room alias #BAO-193:matrix.test-example.ru already exists'
                );
            } catch (err) {
                if (
                    err.message.includes(
                        `Room alias #BAO-193:matrix.test-example.ru already exists`
                    )
                ) {
                    return null;
                }
                throw ['Error while creating alias for a room', err].join('\n');
            }
        });

        const result = await postIssueUpdates({chatApi, ...postIssueUpdatesData});
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(
            ...expectedData
        );
        expect(result).to.be.true;
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

    it('Get error in move with createAlias', async () => {
        chatApi.createAlias.throws('Error!!!');
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

        expect(chatApi.setRoomName).to.be.calledWithExactly(matrixRoomId, data.newName);
        expect(res).to.be.true;
    });
});
