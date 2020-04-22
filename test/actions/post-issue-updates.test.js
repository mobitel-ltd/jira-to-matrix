const proxyquire = require('proxyquire');
const config = require('../../src/config');
const nock = require('nock');
const chai = require('chai');
const translate = require('../../src/locales');
const utils = require('../../src/lib/utils.js');
const issueMovedJSON = require('../fixtures/webhooks/issue/updated/move-issue.json');
const issueStatusChangedJSON = require('../fixtures/webhooks/issue/updated/status-changed.json');
const statusJSON = require('../fixtures/jira-api-requests/status.json');
const descriptionUpdateJSON = require('../fixtures/webhooks/issue/updated/description-update.json');
const { getPostIssueUpdatesData } = require('../../src/jira-hook-parser/parse-body.js');
const { isPostIssueUpdates } = require('../../src/jira-hook-parser/bot-handler.js');
const { postIssueUpdates } = require('../../src/bot/actions');
const { isArchiveStatus } = require('../../src/bot/actions/post-issue-updates');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const testUtils = require('../test-utils');
const { pipe, set, clone } = require('lodash/fp');
const issueBodyJSON = require('../fixtures/jira-api-requests/issue.json');

chai.use(sinonChai);

describe('Post issue updates test', () => {
    const roomId = '!abcdefg:matrix';
    let chatApi;

    const postIssueUpdatesData = getPostIssueUpdatesData(issueMovedJSON);
    const { displayName: userName } = issueMovedJSON.user;
    const changes =
        '<br>issuetype: Story<br>project: Internal Development<br>status: To Do<br>Workflow: Software Simplified Workflow for Project INDEV<br>Key: INDEV-130';
    const expectedData = [
        roomId,
        translate('issueHasChanged'),
        `${translate('issue_updated', { name: userName })}${changes}`,
    ];

    const yellowStatusId = '102031';
    const yellowStatus = pipe(clone, set('statusCategory.colorName', 'yellow'))(statusJSON);
    const greenStatusId = '102030';
    const greenStatus = pipe(clone, set('statusCategory.colorName', utils.LAST_STATUS_COLOR))(statusJSON);
    beforeEach(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${utils.getKey(descriptionUpdateJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${utils.getKey(descriptionUpdateJSON)}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getOldKey(issueMovedJSON)}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getOldKey(issueMovedJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${utils.getKey(issueStatusChangedJSON)}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getKey(issueStatusChangedJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/status/${issueStatusChangedJSON.changelog.items[0].to}`)
            .reply(200, greenStatus)
            .get(`/status/${yellowStatusId}`)
            .reply(200, yellowStatus)
            .get(`/status/${greenStatusId}`)
            .reply(200, greenStatus);

        chatApi = testUtils.getChatApi();
        chatApi.getRoomId
            .resolves(roomId)
            .withArgs(null)
            .throws('Error');
    });

    after(() => {
        nock.cleanAll();
    });

    const project = 'LALALA';
    const exportOptions = {
        options: {
            lastIssue: [project],
        },
    };

    it('should return true if all data is expected', async () => {
        const res = await isArchiveStatus(exportOptions, project, greenStatusId);
        expect(res).to.be.true;
    });

    it('should return false if color is yellow in staus', async () => {
        const res = await isArchiveStatus(exportOptions, project, yellowStatusId);
        expect(res).to.be.false;
    });

    it('should return false if empty data passed', async () => {
        const res = await isArchiveStatus(undefined, project, greenStatusId);
        expect(res).to.be.false;
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates({ chatApi, config, ...postIssueUpdatesData });
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('test isPostIssueUpdates', () => {
        const result = isPostIssueUpdates(issueMovedJSON);
        expect(result).to.be.ok;
    });

    it('Get error with empty issueID', async () => {
        const newBody = { ...postIssueUpdatesData, oldKey: null };
        let result;
        try {
            result = await postIssueUpdates({ chatApi, config, ...newBody });
        } catch (error) {
            result = error;
        }
        expect(result).to.be.string;
    });

    it('Get true with empty newKey', async () => {
        const newBody = { ...postIssueUpdatesData, newKey: null };

        const result = await postIssueUpdates({ chatApi, config, ...newBody });
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error in postUpdateInfo', async () => {
        chatApi.sendHtmlMessage.reset();
        chatApi.sendHtmlMessage.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');

        let res;

        try {
            res = await postIssueUpdates({ chatApi, ...postIssueUpdatesData });
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
            res = await postIssueUpdates({ chatApi, config, ...postIssueUpdatesData });
        } catch (err) {
            res = err;
        }
        expect(res).to.deep.equal(expected);
    });

    it('Expect no error with description changed and no new name includes', async () => {
        const data = getPostIssueUpdatesData(descriptionUpdateJSON);
        const res = await postIssueUpdates({ chatApi, config, ...data });

        expect(res).to.be.true;
    });

    it('Expect name to be changed if only summary updated', async () => {
        const changelog = {
            id: '52267',
            items: [
                {
                    field: 'summary',
                    fieldtype: 'jira',
                    fieldId: 'summary',
                    from: null,
                    fromString: 'Тестовая задача',
                    to: null,
                    toString: 'Моя тестовая задача',
                },
            ],
        };

        const onlySummaryUpdateJSON = { ...descriptionUpdateJSON, changelog };
        const data = getPostIssueUpdatesData(onlySummaryUpdateJSON);
        const res = await postIssueUpdates({ chatApi, config, ...data });

        expect(chatApi.updateRoomName).to.be.calledWithExactly(roomId, {
            key: data.oldKey,
            summary: changelog.items[0].toString,
        });
        expect(res).to.be.true;
    });

    it('Expect status changes with room avatar color change', async () => {
        const issueKey = issueStatusChangedJSON.issue.key;
        const colorConfig = { ...config, colors: { ...config.colors, projects: issueKey.split('-')[0] } };
        const expectedColorLink = config.colors.links[greenStatus.statusCategory.colorName];

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates({ chatApi, config: colorConfig, ...data });

        expect(res).to.be.true;
        expect(chatApi.setRoomAvatar).have.to.be.calledWithExactly(roomId, expectedColorLink);
    });

    it('Expect status changes but room avatar not changed because project of room is not exists in config.color.projects', async () => {
        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates({ chatApi, config, ...data });

        expect(res).to.be.true;
        expect(chatApi.setRoomAvatar).not.to.be.called;
    });

    it('Expect status changes but room avatar not changed because config.color.projects is empty', async () => {
        const colorConfig = { ...config, colors: { links: config.colors.links } };
        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates({ chatApi, config: colorConfig, ...data });

        expect(res).to.be.true;
        expect(chatApi.setRoomAvatar).not.to.be.called;
    });

    it('should work with kick', async () => {
        const kickStub = stub();
        const { postIssueUpdates: postIssueUpdates_ } = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(true), isRepoExists: stub().resolves(true) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data });
        expect(res).to.be.true;
        expect(kickStub).to.be.called;
    });

    it('should work with kick if repo not exists', async () => {
        const kickStub = stub();
        const { postIssueUpdates: postIssueUpdates_ } = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(true), isRepoExists: stub().resolves(false) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data });
        expect(res).to.be.true;
        expect(kickStub).not.to.be.called;
    });

    it('should work with kick if some error in export happen', async () => {
        const kickStub = stub();
        const { postIssueUpdates: postIssueUpdates_ } = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(false), isRepoExists: stub().resolves(true) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data });
        expect(res).to.be.true;
        expect(kickStub).not.to.be.called;
    });

    it('Should return false if issue is not exists', async () => {
        nock.cleanAll();

        const result = await postIssueUpdates({ chatApi, ...postIssueUpdatesData });
        expect(result).to.be.false;
    });
});
