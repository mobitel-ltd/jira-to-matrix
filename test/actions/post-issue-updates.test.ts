import querystring from 'querystring';
import proxyquire from 'proxyquire';
import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import { translate } from '../../src/locales';
import issueMovedJSON from '../fixtures/webhooks/issue/updated/move-issue.json';
import issueStatusChangedJSON from '../fixtures/webhooks/issue/updated/status-changed.json';
import statusJSON from '../fixtures/jira-api-requests/status.json';
import descriptionUpdateJSON from '../fixtures/webhooks/issue/updated/description-update.json';
import { PostIssueUpdates } from '../../src/bot/actions/post-issue-updates';
import renderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
import { taskTracker, getChatClass } from '../test-utils';
import { pipe, set, clone } from 'lodash/fp';
import issueBodyJSON from '../fixtures/jira-api-requests/issue.json';
import { Jira } from '../../src/task-trackers/jira';
import { LAST_STATUS_COLOR } from '../../src/redis-client';
import { Config, PostIssueUpdatesData, RoomViewStateEnum } from '../../src/types';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabIssueUpdated from '../fixtures/webhooks/gitlab/issue/updated.json';
import gitlabIssueNewAssign from '../fixtures/webhooks/gitlab/issue/new-assign.json';
import gitlabProjectJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import gitlabClosedIssueJson from '../fixtures/gitlab-api-requests/closed-issue.json';
import gitlabClosedIssue from '../fixtures/webhooks/gitlab/issue/closed.json';
import gitlabReopenedIssue from '../fixtures/webhooks/gitlab/issue/reopened.json';

const { expect } = chai;

chai.use(sinonChai);

describe('Post issue updates test', () => {
    const roomId = '!abcdefg:matrix';
    let chatApi;
    let chatSingle;
    const messengerLink = 'lalala';
    let postIssueUpdates: PostIssueUpdates;

    const postIssueUpdatesData = taskTracker.parser.getPostIssueUpdatesData(issueMovedJSON);
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
    const greenStatus: any = pipe(clone, set('statusCategory.colorName', LAST_STATUS_COLOR))(statusJSON);
    beforeEach(() => {
        nock(taskTracker.getRestUrl())
            .get(`/issue/${descriptionUpdateJSON.issue.key}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${descriptionUpdateJSON.issue.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${taskTracker.selectors.getOldKey(issueMovedJSON)}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${taskTracker.selectors.getOldKey(issueMovedJSON)}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueStatusChangedJSON.issue.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${issueStatusChangedJSON.issue.key}`)
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
        chatSingle.uploadContent.resolves(messengerLink);

        chatSingle.getRoomId
            .resolves(roomId)
            .withArgs(null)
            .throws('Error');

        postIssueUpdates = new PostIssueUpdates(config, taskTracker, chatApi);
    });

    after(() => {
        nock.cleanAll();
    });

    const project = 'LALALA';
    const issueKey = project + '-1';

    describe('isArchiveStatus', () => {
        beforeEach(() => {
            const colorConfig = {
                ...config,
                gitArchive: { ...config.gitArchive, options: { lastIssue: [project] } },
            };

            postIssueUpdates = new PostIssueUpdates(colorConfig as Config, taskTracker, chatApi);
        });

        it('should return true if all data is expected', async () => {
            const res = await postIssueUpdates.isArchiveStatus(project, issueKey, greenStatusId);
            expect(res).to.be.true;
        });

        it('should return false if color is yellow in staus', async () => {
            const res = await postIssueUpdates.isArchiveStatus(project, issueKey, yellowStatusId);
            expect(res).to.be.false;
        });

        it('should return false if empty data passed', async () => {
            const res = await postIssueUpdates.isArchiveStatus(project, issueKey);
            expect(res).to.be.false;
        });
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates.run(postIssueUpdatesData);
        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('test isPostIssueUpdates', () => {
        const result = taskTracker.parser.isPostIssueUpdates(issueMovedJSON);
        expect(result).to.be.ok;
    });

    it('Get error with empty issueId', async () => {
        const newBody = set('oldKey', undefined, postIssueUpdatesData);
        let result;
        try {
            result = await postIssueUpdates.run(newBody);
        } catch (error) {
            result = error;
        }
        expect(result).to.be.string;
    });

    it('Get true with empty newKey', async () => {
        const newBody = set('newKey', undefined, postIssueUpdatesData);

        const result = await postIssueUpdates.run(newBody);
        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error in postUpdateInfo', async () => {
        chatSingle.sendHtmlMessage.reset();
        chatSingle.sendHtmlMessage.throws('Error!!!');
        const expected = ['Error in postIssueUpdates', 'Error!!!'].join('\n');

        let res;

        try {
            res = await postIssueUpdates.run(postIssueUpdatesData);
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
            res = await postIssueUpdates.run(postIssueUpdatesData);
        } catch (err) {
            res = err;
        }
        expect(res).to.deep.equal(expected);
    });

    it('Expect no error with description changed and no new name includes', async () => {
        const data = taskTracker.parser.getPostIssueUpdatesData(descriptionUpdateJSON);
        const res = await postIssueUpdates.run(data);

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
        const data = taskTracker.parser.getPostIssueUpdatesData(onlySummaryUpdateJSON);
        const res = await postIssueUpdates.run(data);

        expect(chatSingle.updateRoomName).to.be.calledWithExactly(
            roomId,
            `${data.oldKey} ${changelog.items[0].toString}`,
        );
        expect(res).to.be.true;
    });

    it('Expect status changes with room avatar color change', async () => {
        const issueKey = issueStatusChangedJSON.issue.key;
        const colorConfig = { ...config, colors: { ...config.colors, projects: [issueKey.split('-')[0]] } };

        const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
        postIssueUpdates = new PostIssueUpdates(colorConfig, taskTracker, chatApi);

        const res = await postIssueUpdates.run(data);

        expect(res).to.be.true;
        expect(chatSingle.setRoomAvatar).have.to.be.calledWithExactly(roomId, messengerLink);
    });

    it('Expect status changes but room avatar not changed because project of room is not exists in config.color.projects', async () => {
        const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
        const res = await postIssueUpdates.run(data);

        expect(res).to.be.true;
        expect(chatSingle.setRoomAvatar).not.to.be.called;
    });

    // it('Expect status changes but room avatar not changed because config.color.projects is empty', async () => {
    //     const colorConfig = { ...config, colors: { links: config.colors.links } };
    //     const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
    //     const res = await postIssueUpdates.run({ chatApi, config: colorConfig, taskTracker, ...data });

    //     expect(res).to.be.true;
    //     expect(chatSingle.setRoomAvatar).not.to.be.called;
    // });

    it('should work with kick', async () => {
        const kickStub = stub();
        const proxyPostIssueUpdate = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(true), isRepoExists: stub().resolves(true) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);
        postIssueUpdates = new proxyPostIssueUpdate.PostIssueUpdates(archiveConfig, taskTracker, chatApi);

        const res = await postIssueUpdates.run(data);
        expect(res).to.be.true;
        expect(kickStub).to.be.called;
    });

    it('should work with kick if repo not exists', async () => {
        const kickStub = stub();
        const proxyPostIssueUpdate = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(true), isRepoExists: stub().resolves(false) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);
        postIssueUpdates = new proxyPostIssueUpdate.PostIssueUpdates(archiveConfig, taskTracker, chatApi);

        const res = await postIssueUpdates.run(data);
        expect(res).to.be.true;
        expect(kickStub).not.to.be.called;
    });

    it('should work with kick if some error in export happen', async () => {
        const kickStub = stub();
        const proxyPostIssueUpdate = proxyquire('../../src/bot/actions/post-issue-updates', {
            '../../lib/git-lib': { exportEvents: stub().resolves(false), isRepoExists: stub().resolves(true) },
            '../commands/command-list/common-actions': { kick: kickStub },
        });

        const data = taskTracker.parser.getPostIssueUpdatesData(issueStatusChangedJSON);
        const archiveConfig = pipe(clone, set('gitArchive.options.lastIssue', ['INDEV']))(config);
        postIssueUpdates = new proxyPostIssueUpdate.PostIssueUpdates(archiveConfig, taskTracker, chatApi);

        const res = await postIssueUpdates.run(data);
        expect(res).to.be.true;
        expect(kickStub).not.to.be.called;
    });

    it('Should return false if issue is not exists', async () => {
        nock.cleanAll();

        const result = await postIssueUpdates.run(postIssueUpdatesData);
        expect(result).to.be.false;
    });
});

describe('PostIssueUpdates in Gitlab', () => {
    let gitlabTracker: Gitlab;
    let chatApi;
    let chatSingle;
    let postIssueUpdates: PostIssueUpdates;
    let postIssueUpdatesData: PostIssueUpdatesData;
    const roomId = '!abcdefg:matrix';
    const messengerLink = 'lalala';

    beforeEach(() => {
        gitlabTracker = new Gitlab({
            url: 'https://gitlab.test-example.ru',
            user: 'gitlab_bot',
            password: 'fakepasswprd',
            features: config.features,
        });
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Title updated', () => {
        const changes = `<br>title: ${gitlabIssueUpdated.changes.title.current}`;
        const expectedData = [
            roomId,
            translate('issueHasChanged'),
            `${translate('issue_updated', { name: gitlabIssueUpdated.user.name })}${changes}`,
        ];

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(gitlabIssueUpdated.project.path_with_namespace)}`)
                .times(3)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabIssueUpdated.object_attributes.iid}`)
                .times(3)
                .reply(200, gitlabIssueJson);
            postIssueUpdatesData = gitlabTracker.parser.getPostIssueUpdatesData(gitlabIssueUpdated);
            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.getRoomId
                .resolves(roomId)
                .withArgs(null)
                .throws('Error');

            postIssueUpdates = new PostIssueUpdates(config, gitlabTracker, chatApi);
        });

        it('Is correct postIssueUpdatesData', async () => {
            const result = await postIssueUpdates.run(postIssueUpdatesData);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
            expect(result).to.be.true;
        });
    });

    describe('New user assigned', () => {
        const changes = `<br>assignees: ${gitlabIssueNewAssign.changes.assignees.current[0].name}`;
        const expectedData = [
            roomId,
            translate('issueHasChanged'),
            `${translate('issue_updated', { name: gitlabIssueNewAssign.user.name })}${changes}`,
        ];

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(gitlabIssueNewAssign.project.path_with_namespace)}`)
                .times(2)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabIssueNewAssign.object_attributes.iid}`)
                .times(2)
                .reply(200, gitlabIssueJson);
            postIssueUpdatesData = gitlabTracker.parser.getPostIssueUpdatesData(gitlabIssueNewAssign);
            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.getRoomId
                .resolves(roomId)
                .withArgs(null)
                .throws('Error');

            postIssueUpdates = new PostIssueUpdates(config, gitlabTracker, chatApi);
        });

        it('should send correct update info', async () => {
            const result = await postIssueUpdates.run(postIssueUpdatesData);
            expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
            expect(result).to.be.true;
        });
    });

    describe('Issue closed', () => {
        const changes = `<br>status: ${RoomViewStateEnum.close}`;
        const expectedData = [
            roomId,
            translate('issueHasChanged'),
            `${translate('issue_updated', { name: gitlabClosedIssue.user.name })}${changes}`,
        ];

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(gitlabClosedIssue.project.path_with_namespace)}`)
                .times(4)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabClosedIssue.object_attributes.iid}`)
                .times(4)
                .reply(200, gitlabClosedIssueJson);
            postIssueUpdatesData = gitlabTracker.parser.getPostIssueUpdatesData(gitlabClosedIssue);
            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.uploadContent.resolves(messengerLink);

            chatSingle.getRoomId
                .resolves(roomId)
                .withArgs(null)
                .throws('Error');

            const allColorsConfig = pipe(clone, set('colors.projects', 'all'))(config) as Config;
            postIssueUpdates = new PostIssueUpdates(allColorsConfig, gitlabTracker, chatApi);
        });

        it('should send correct update info', async () => {
            const result = await postIssueUpdates.run(postIssueUpdatesData);
            expect(result).to.be.true;
            expect(chatSingle.setRoomAvatar).have.to.be.calledWithExactly(roomId, messengerLink);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });
    });

    describe('Issue reopened', () => {
        const changes = `<br>status: ${RoomViewStateEnum.open}`;
        const expectedData = [
            roomId,
            translate('issueHasChanged'),
            `${translate('issue_updated', { name: gitlabReopenedIssue.user.name })}${changes}`,
        ];

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(gitlabReopenedIssue.project.path_with_namespace)}`)
                .times(3)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabReopenedIssue.object_attributes.iid}`)
                .times(3)
                .reply(200, gitlabIssueJson);
            postIssueUpdatesData = gitlabTracker.parser.getPostIssueUpdatesData(gitlabReopenedIssue);
            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.getRoomId
                .resolves(roomId)
                .withArgs(null)
                .throws('Error');

            postIssueUpdates = new PostIssueUpdates(config, gitlabTracker, chatApi);
        });

        it('should send correct update info', async () => {
            const result = await postIssueUpdates.run(postIssueUpdatesData);
            expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
            expect(result).to.be.true;
        });
    });
});
