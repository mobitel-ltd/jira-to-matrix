import { pipe, set, clone } from 'lodash/fp';
import nock from 'nock';
import { CreateRoom } from '../../src/bot/actions/create-room';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { getChatClass, taskTracker, getUserIdByDisplayName } from '../test-utils';

import commentCreatedJSON from '../fixtures/webhooks/comment/created.json';
import renderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import epicJSON from '../fixtures/webhooks/epic/created.json';
import projectJSON from '../fixtures/webhooks/project/created.json';
import issueCreatedHook from '../fixtures/webhooks/issue/created.json';
import watchersBody from '../fixtures/jira-api-requests/watchers.json';
import projectData from '../fixtures/jira-api-requests/project.json';
import issueBodyJSON from '../fixtures/jira-api-requests/issue.json';
import { Jira } from '../../src/task-trackers/jira';
import { CreateRoomData, CreateRoomOpions, IssueStateEnum } from '../../src/types';
import { getDefaultErrorLog } from '../../src/lib/utils';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabCommentCreatedHook from '../fixtures/webhooks/gitlab/commented.json';
import gitlabProjectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import projectMembersJson from '../fixtures/gitlab-api-requests/project-members.json';
import gitlabIssueCreatedJson from '../fixtures/webhooks/gitlab/issue/created.json';

const { expect } = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    let chatApi;
    let options: CreateRoomData;
    let createRoom: CreateRoom;

    const notFoundUserIssueKey = 'KEY';
    const notFoundUser = 'not_found_user';
    const issueWithIncorrectCreator = pipe(
        clone,
        set('fields.creator.displayName', notFoundUser),
        set('key', notFoundUserIssueKey),
    )(issueBodyJSON);

    const members = [
        getUserIdByDisplayName(issueBodyJSON.fields.reporter.displayName),
        getUserIdByDisplayName(issueBodyJSON.fields.creator.displayName),
        getUserIdByDisplayName(issueBodyJSON.fields.assignee.displayName),
    ].map(name => getChatClass().chatApiSingle.getChatUserId(name));

    // colors INDEV-749
    const [projectForAvatar] = config.colors.projects;
    const issueKeyAvatar = `${projectForAvatar}-123`;

    const watchers = watchersBody.watchers
        .map(({ displayName }) => displayName !== 'jira_bot' && displayName)
        .filter(Boolean)
        .map(getUserIdByDisplayName)
        .map(getChatClass().chatApiSingle.getChatUserId);
    const errorMsg = 'some error';

    const createRoomData = taskTracker.parser.getCreateRoomData(issueCreatedHook);

    const projectKey = epicJSON.issue.fields.project.key;

    const expectedEpicRoomOptions: CreateRoomOpions = {
        room_alias_name: issueBodyJSON.key,
        invite: [...new Set([...members, ...watchers])],
        name: getChatClass().chatApiSingle.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
        topic: taskTracker.getViewUrl(issueBodyJSON.key),
        purpose: taskTracker.selectors.getSummary(issueBodyJSON),
        avatarUrl: undefined,
    };

    const expectedIssueRoomOptions = {
        room_alias_name: createRoomData.issue.key,
        invite: [...new Set([...members, ...watchers])],
        name: getChatClass().chatApiSingle.composeRoomName(createRoomData.issue.key, createRoomData.issue.summary),
        topic: taskTracker.getViewUrl(createRoomData.issue.key),
        purpose: createRoomData.issue.summary,
        avatarUrl: undefined,
    };

    const expectedIssueRoomOptionsNoSummary = {
        room_alias_name: issueBodyJSON.key,
        invite: [...new Set([...members, ...watchers])],
        name: getChatClass().chatApiSingle.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
        topic: taskTracker.getViewUrl(issueBodyJSON.key),
        purpose: issueBodyJSON.fields.summary,
        avatarUrl: undefined,
    };

    const expectedIssueAvatar = {
        room_alias_name: issueKeyAvatar,
        invite: [...new Set([...members, ...watchers])],
        name: getChatClass().chatApiSingle.composeRoomName(issueKeyAvatar, issueBodyJSON.fields.summary),
        topic: taskTracker.getViewUrl(issueKeyAvatar),
        purpose: issueBodyJSON.fields.summary,
        avatarUrl: config.colors.links.issue,
    };

    const expectedEpicProjectOptions = {
        room_alias_name: projectKey,
        invite: [getChatClass().chatApiSingle.getChatUserId(getUserIdByDisplayName(projectData.lead.displayName))],
        name: getChatClass().chatApiSingle.composeRoomName(projectData.key, projectData.name),
        topic: taskTracker.getViewUrl(projectKey),
    };

    const expectedCreateProjectOptions = {
        room_alias_name: projectJSON.project.key,
        invite: [getChatClass().chatApiSingle.getChatUserId(getUserIdByDisplayName(projectData.lead.displayName))],
        name: getChatClass().chatApiSingle.composeRoomName(projectData.key, projectData.name),
        topic: taskTracker.getViewUrl(projectJSON.project.key),
    };

    beforeEach(() => {
        const chatClass = getChatClass({
            alias: [createRoomData.issue.key, createRoomData.projectKey!],
            roomId: [createRoomData.issue.key, createRoomData.projectKey!],
        });
        chatApi = chatClass.chatApiSingle;
        createRoom = new CreateRoom(config, taskTracker, chatApi);

        nock(taskTracker.getRestUrl())
            // comment created hook
            .get(`/issue/${taskTracker.selectors.getIssueId(commentCreatedJSON)}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueBodyJSON.key}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${notFoundUserIssueKey}`)
            .times(4)
            .reply(200, issueWithIncorrectCreator as any)
            .get(`/issue/${notFoundUserIssueKey}/watchers`)
            .reply(200, watchersBody)
            .get(`/issue/${notFoundUserIssueKey}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${createRoomData.issue.key}`)
            .times(3)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueBodyJSON.key}/watchers`)
            .reply(200, watchersBody)
            .get(`/issue/${issueBodyJSON.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            // room created hook
            .get(`/issue/${createRoomData.issue.key}/watchers`)
            .reply(200, watchersBody)
            // avatar
            .get(`/issue/${issueKeyAvatar}`)
            .times(3)
            .reply(200, { ...issueBodyJSON, key: issueKeyAvatar })
            .get(`/issue/${issueKeyAvatar}/watchers`)
            .reply(200, watchersBody)
            .get(`/issue/${issueKeyAvatar}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${epicJSON.issue.key}/watchers`)
            .reply(200, watchersBody)
            .get(`/project/${projectKey}`)
            .reply(200, projectData)
            .get(`/project/${issueCreatedHook.issue.fields.project.key}`)
            .reply(200, projectData)
            .get(`/project/${projectJSON.project.key}`)
            .reply(200, projectData)
            .get(`/issue/${createRoomData.issue.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${epicJSON.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${epicJSON.issue.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect both issue room and project room not to be created if we run simple issue_created and both chat room exists in chat', async () => {
        const result = await createRoom.run(createRoomData);
        expect(result).to.be.true;
        expect(chatApi.createRoom).not.to.be.called;
    });

    it("Expect room should be created if it's not exists and project creates if we run simple issue_created", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run(createRoomData);
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
        expect(result).to.be.true;
    });

    it('Expect project and epic rooms should be created if Epic body we get and no rooms exists', async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run(taskTracker.parser.getCreateRoomData(epicJSON));
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicRoomOptions);
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicProjectOptions);
        expect(result).to.be.true;
    });

    it('Expect project should be created if project_created hook we get and no project room exists', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom.run(taskTracker.parser.getCreateRoomData(projectJSON));
        expect(chatApi.createRoom).to.be.calledOnceWithExactly(expectedCreateProjectOptions);
        expect(result).to.be.true;
    });

    it('Expect error in room create throws error', async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        chatApi.createRoom.throws(errorMsg);
        let res;
        const expectedError = [getDefaultErrorLog('create room'), getDefaultErrorLog('createIssueRoom'), errorMsg].join(
            '\n',
        );

        try {
            res = await createRoom.run(taskTracker.parser.getCreateRoomData(epicJSON));
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });

    it('Expect error in room createRoomProject throw error', async () => {
        chatApi.createRoom.throws(errorMsg);
        let res;
        const expectedError = [
            getDefaultErrorLog('create room'),
            getDefaultErrorLog('createProjectRoom'),
            errorMsg,
        ].join('\n');

        try {
            chatApi.getRoomId.callsFake(id => !(id === projectKey));

            const result = await createRoom.run({ ...options, ...createRoomData, projectKey });
            expect(result).not.to.be;
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });

    it('Expect room not creates if issue not exists', async () => {
        nock.cleanAll();
        const result = await createRoom.run({
            ...taskTracker.parser.getCreateRoomData(commentCreatedJSON),
        });

        expect(chatApi.createRoom).not.to.be.called;
        expect(result).to.be.false;
    });

    it('Expect room created if we get create_comment hook', async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run({
            ...taskTracker.parser.getCreateRoomData(commentCreatedJSON),
        });

        expect(chatApi.createRoom).to.be.calledWithExactly({
            room_alias_name: issueBodyJSON.key,
            // beacause watchers are includes issue assigne in this case
            invite: [...new Set([...members, ...watchers])],
            name: getChatClass().chatApiSingle.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
            topic: taskTracker.getViewUrl(issueBodyJSON.key),
            purpose: issueBodyJSON.fields.summary,
            avatarUrl: undefined,
        });
        expect(result).to.be.true;
    });

    it("Expect room should be created if it's not exists and project creates if we run create room with only key", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run({
            issue: {
                key: createRoomData.issue.key,
                projectKey: createRoomData.projectKey,
                descriptionFields: { typeName: createRoomData.issue.descriptionFields!.typeName } as any,
            },
        });
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptionsNoSummary);
        expect(result).to.be.true;
    });

    it("Expect room should be created if it's not exists with avatar url if no project is in the config list colors", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run({
            ...options,
            issue: {
                key: issueKeyAvatar,
                projectKey: projectForAvatar,
                descriptionFields: { typeName: 'Task' } as any,
            },
        });

        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueAvatar);
        expect(result).to.be.true;
    });
    it('Expect room should be created if descriptionFields not exist in roomdata', async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom.run({
            issue: { key: issueKeyAvatar, projectKey: projectForAvatar },
        });

        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueAvatar);
        expect(result).to.be.true;
    });

    it('Expect create room not invite user without chat id', async () => {
        const result = await createRoom.run({ ...options, issue: { key: notFoundUserIssueKey } });

        expect(result).to.be.true;
        expect(chatApi.createRoom).to.be.called;
    });
});

describe('Create room test with gitlab as task tracker', () => {
    let gitlabTracker: Gitlab;
    let chatApi;
    let createRoom: CreateRoom;

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

    describe('Comment hook', () => {
        let createRoomData: CreateRoomData;
        beforeEach(() => {
            createRoomData = gitlabTracker.parser.getCreateRoomData(gitlabCommentCreatedHook);
            const chatClass = getChatClass({
                alias: [createRoomData.issue.key, createRoomData.projectKey!],
                roomId: [createRoomData.issue.key, createRoomData.projectKey!],
            });
            chatApi = chatClass.chatApiSingle;
            createRoom = new CreateRoom(config, gitlabTracker, chatApi);
        });

        it('should return correct createRoomData', async () => {
            const expected: CreateRoomData = {
                issue: {
                    key:
                        gitlabCommentCreatedHook.project.path_with_namespace + '-' + gitlabCommentCreatedHook.issue.iid,
                    descriptionFields: undefined,
                    projectKey: gitlabCommentCreatedHook.project.path_with_namespace,
                    summary: gitlabCommentCreatedHook.issue.description,
                },
                projectKey: gitlabCommentCreatedHook.project.path_with_namespace,
            };
            expect(createRoomData).to.be.deep.eq(expected);
        });

        describe('Room is exists', () => {
            beforeEach(() => {
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects`)
                    .query({ search: gitlabCommentCreatedHook.project.path_with_namespace })
                    .reply(200, gitlabProjectsJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
                    .reply(200, gitlabIssueJson);
            });

            it('should not call create room if they are alredy exists', async () => {
                const result = await createRoom.run(createRoomData);
                expect(result).to.be.true;
                expect(chatApi.createRoom).not.to.be.called;
            });
        });

        describe('Room is not exists', () => {
            let expectedIssueRoomOptions: CreateRoomOpions;
            beforeEach(() => {
                const issueKey =
                    gitlabCommentCreatedHook.project.path_with_namespace + '-' + gitlabCommentCreatedHook.issue.iid;
                const members = [
                    getUserIdByDisplayName(gitlabIssueJson.assignee.name),
                    getUserIdByDisplayName(gitlabIssueJson.author.name),
                ].map(name => getChatClass().chatApiSingle.getChatUserId(name));
                const roomName =
                    '#' +
                    gitlabCommentCreatedHook.issue.iid +
                    ';' +
                    IssueStateEnum.open +
                    ';' +
                    gitlabIssueJson.title +
                    ';' +
                    gitlabCommentCreatedHook.project.path_with_namespace +
                    '/issues/' +
                    gitlabCommentCreatedHook.issue.iid;

                expectedIssueRoomOptions = {
                    invite: members,
                    name: roomName,
                    room_alias_name:
                        gitlabCommentCreatedHook.project.path_with_namespace + '-' + gitlabCommentCreatedHook.issue.iid,
                    avatarUrl: undefined,
                    topic: gitlabTracker.getViewUrl(issueKey),
                    purpose: gitlabIssueJson.title,
                };
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects`)
                    .query({ search: gitlabCommentCreatedHook.project.path_with_namespace })
                    .times(3)
                    .reply(200, gitlabProjectsJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
                    .times(3)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/members/all`)
                    .reply(200, projectMembersJson);
            });

            it('should call room creation', async () => {
                chatApi.getRoomIdByName.reset();
                chatApi.getRoomIdByName.resolves(false);
                const result = await createRoom.run(createRoomData);
                expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
                expect(result).to.be.true;
            });
        });
    });

    describe('Issue created hook', () => {
        let createRoomData: CreateRoomData;
        beforeEach(() => {
            createRoomData = gitlabTracker.parser.getCreateRoomData(gitlabIssueCreatedJson);
            const chatClass = getChatClass({
                alias: [createRoomData.issue.key, createRoomData.projectKey!],
                roomId: [createRoomData.issue.key, createRoomData.projectKey!],
            });
            chatApi = chatClass.chatApiSingle;
            createRoom = new CreateRoom(config, gitlabTracker, chatApi);
        });

        it('should return correct createRoomData', async () => {
            const expected: CreateRoomData = {
                issue: {
                    key:
                        gitlabIssueCreatedJson.project.path_with_namespace +
                        '-' +
                        gitlabIssueCreatedJson.object_attributes.iid,
                    descriptionFields: undefined,
                    projectKey: gitlabIssueCreatedJson.project.path_with_namespace,
                    summary: gitlabIssueCreatedJson.object_attributes.title,
                },
                projectKey: gitlabIssueCreatedJson.project.path_with_namespace,
            };
            expect(createRoomData).to.be.deep.eq(expected);
        });

        describe('Room is exists', () => {
            beforeEach(() => {
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects`)
                    .query({ search: gitlabIssueCreatedJson.project.path_with_namespace })
                    .reply(200, gitlabProjectsJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`)
                    .reply(200, gitlabIssueJson);
            });

            it('should not call create room if they are alredy exists', async () => {
                const result = await createRoom.run(createRoomData);
                expect(result).to.be.true;
                expect(chatApi.createRoom).not.to.be.called;
            });
        });

        describe('Room is not exists', () => {
            let expectedIssueRoomOptions: CreateRoomOpions;
            beforeEach(() => {
                const issueKey =
                    gitlabIssueCreatedJson.project.path_with_namespace +
                    '-' +
                    gitlabIssueCreatedJson.object_attributes.iid;
                const members = [
                    getUserIdByDisplayName(gitlabIssueJson.assignee.name),
                    getUserIdByDisplayName(gitlabIssueJson.author.name),
                ].map(name => getChatClass().chatApiSingle.getChatUserId(name));

                const roomName =
                    '#' +
                    gitlabIssueCreatedJson.object_attributes.iid +
                    ';' +
                    IssueStateEnum.open +
                    ';' +
                    gitlabIssueJson.title +
                    ';' +
                    gitlabIssueCreatedJson.project.path_with_namespace +
                    '/issues/' +
                    gitlabIssueCreatedJson.object_attributes.iid;

                expectedIssueRoomOptions = {
                    invite: members,
                    name: roomName,
                    room_alias_name:
                        gitlabIssueCreatedJson.project.path_with_namespace +
                        '-' +
                        gitlabIssueCreatedJson.object_attributes.iid,
                    avatarUrl: undefined,
                    topic: gitlabTracker.getViewUrl(issueKey),
                    purpose: gitlabIssueJson.title,
                };
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects`)
                    .query({ search: gitlabIssueCreatedJson.project.path_with_namespace })
                    .times(3)
                    .reply(200, gitlabProjectsJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`)
                    .times(3)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectsJson[0].id}/members/all`)
                    .reply(200, projectMembersJson);
            });

            it('should call room creation', async () => {
                chatApi.getRoomIdByName.reset();
                chatApi.getRoomIdByName.resolves(false);
                const result = await createRoom.run(createRoomData);
                expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
                expect(result).to.be.true;
            });
        });
    });
});
