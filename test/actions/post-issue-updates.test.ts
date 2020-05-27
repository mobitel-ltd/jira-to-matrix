import proxyquire from 'proxyquire';
import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import { translate } from '../../src/locales';
import * as utils from '../../src/lib/utils';
import issueMovedJSON from '../fixtures/webhooks/issue/updated/move-issue.json';
import issueStatusChangedJSON from '../fixtures/webhooks/issue/updated/status-changed.json';
import statusJSON from '../fixtures/jira-api-requests/status.json';
import descriptionUpdateJSON from '../fixtures/webhooks/issue/updated/description-update.json';
import { getPostIssueUpdatesData } from '../../src/hook-parser/parsers/jira/parse-body';
import { isPostIssueUpdates } from '../../src/hook-parser/parsers/jira';
import { postIssueUpdates } from '../../src/bot/actions';
import { isArchiveStatus } from '../../src/bot/actions/post-issue-updates';
import renderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
import { taskTracker, getChatClass } from '../test-utils';
import { pipe, set, clone } from 'lodash/fp';
import issueBodyJSON from '../fixtures/jira-api-requests/issue.json';
import { Jira } from '../../src/task-trackers/jira';
const { expect } = chai;

chai.use(sinonChai);

describe('Post issue updates test', () => {
    const roomId = '!abcdefg:matrix';
    let chatApi;
    let chatSingle;

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
    const yellowStatus: any = pipe(clone, set('statusCategory.colorName', 'yellow'))(statusJSON);
    const greenStatusId = '102030';
    const greenStatus: any = pipe(clone, set('statusCategory.colorName', utils.LAST_STATUS_COLOR))(statusJSON);
    beforeEach(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${utils.getKey(descriptionUpdateJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${utils.getKey(descriptionUpdateJSON)}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getOldKey(issueMovedJSON)}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getOldKey(issueMovedJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${utils.getKey(issueStatusChangedJSON)}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${utils.getKey(issueStatusChangedJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/status/${issueStatusChangedJSON.changelog.items[0].to}`)
            .reply(200, greenStatus)
            .get(`/status/${yellowStatusId}`)
            .reply(200, yellowStatus)
            .get(`/status/${greenStatusId}`)
            .reply(200, greenStatus);

        const chatClass = getChatClass({ roomId });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        chatSingle.getRoomId
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
        const res = await isArchiveStatus(taskTracker, exportOptions, project, greenStatusId);
        expect(res).to.be.true;
    });

    it('should return false if color is yellow in staus', async () => {
        const res = await isArchiveStatus(taskTracker, exportOptions, project, yellowStatusId);
        expect(res).to.be.false;
    });

    it('should return false if empty data passed', async () => {
        const res = await isArchiveStatus(taskTracker, undefined, project, greenStatusId);
        expect(res).to.be.false;
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates({ chatApi, ...postIssueUpdatesData, config, taskTracker });
        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('test isPostIssueUpdates', () => {
        const result = isPostIssueUpdates(issueMovedJSON);
        expect(result).to.be.ok;
    });

    it('Get error with empty issueID', async () => {
        const newBody = set('oldKey', undefined, postIssueUpdatesData);
        let result;
        try {
            result = await postIssueUpdates({ chatApi, ...newBody, config, taskTracker });
        } catch (error) {
            result = error;
        }
        expect(result).to.be.string;
    });

    it('Get true with empty newKey', async () => {
        const newBody = set('newKey', undefined, postIssueUpdatesData);

        const result = await postIssueUpdates({ chatApi, config, taskTracker, ...newBody });
        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error in postUpdateInfo', async () => {
        chatSingle.sendHtmlMessage.reset();
        chatSingle.sendHtmlMessage.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');

        let res;

        try {
            res = await postIssueUpdates({ chatApi, ...postIssueUpdatesData, config, taskTracker });
        } catch (err) {
            res = err;
        }

        expect(res).to.deep.equal(expected);
    });

    it('Get error in move with updateRoomData', async () => {
        chatSingle.updateRoomData.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');
        let res;

        try {
            res = await postIssueUpdates({ chatApi, config, ...postIssueUpdatesData, taskTracker });
        } catch (err) {
            res = err;
        }
        expect(res).to.deep.equal(expected);
    });

    it('Expect no error with description changed and no new name includes', async () => {
        const data = getPostIssueUpdatesData(descriptionUpdateJSON);
        const res = await postIssueUpdates({ chatApi, config, taskTracker, ...data });

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
        const res = await postIssueUpdates({ chatApi, config, taskTracker, ...data });

        expect(chatSingle.updateRoomName).to.be.calledWithExactly(roomId, {
            key: data.oldKey,
            summary: changelog.items[0].toString,
        });
        expect(res).to.be.true;
    });

    it('Expect status changes with room avatar color change', async () => {
        const issueKey = issueStatusChangedJSON.issue.key;
        const colorConfig = { ...config, colors: { ...config.colors, projects: [issueKey.split('-')[0]] } };
        const expectedColorLink = config.colors.links[greenStatus.statusCategory.colorName];

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates({ chatApi, taskTracker, config: colorConfig, ...data });

        expect(res).to.be.true;
        expect(chatSingle.setRoomAvatar).have.to.be.calledWithExactly(roomId, expectedColorLink);
    });

    it('Expect status changes but room avatar not changed because project of room is not exists in config.color.projects', async () => {
        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates({ chatApi, config, taskTracker, ...data });

        expect(res).to.be.true;
        expect(chatSingle.setRoomAvatar).not.to.be.called;
    });

    // it('Expect status changes but room avatar not changed because config.color.projects is empty', async () => {
    //     const colorConfig = { ...config, colors: { links: config.colors.links } };
    //     const data = getPostIssueUpdatesData(issueStatusChangedJSON);
    //     const res = await postIssueUpdates({ chatApi, config: colorConfig, taskTracker, ...data });

    //     expect(res).to.be.true;
    //     expect(chatSingle.setRoomAvatar).not.to.be.called;
    // });

    it('should work with kick', async () => {
        const kickStub = stub();
        const { postIssueUpdates: postIssueUpdates_ } = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(true), isRepoExists: stub().resolves(true) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data, taskTracker });
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

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data, taskTracker });
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

        const res = await postIssueUpdates_({ chatApi, config: archiveConfig, ...data, taskTracker });
        expect(res).to.be.true;
        expect(kickStub).not.to.be.called;
    });

    it('Should return false if issue is not exists', async () => {
        nock.cleanAll();

        const result = await postIssueUpdates({ chatApi, ...postIssueUpdatesData, config, taskTracker });
        expect(result).to.be.false;
    });
});
