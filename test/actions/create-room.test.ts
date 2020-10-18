import querystring from 'querystring';
import { pipe, set, clone } from 'lodash/fp';
import nock from 'nock';
import { CreateRoom } from '../../src/bot/actions/create-room';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { getChatClass, taskTracker, getUserIdByDisplayName, cleanRedis } from '../test-utils';

import commentCreatedJSON from '../fixtures/webhooks/comment/created.json';
import renderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import epicJSON from '../fixtures/webhooks/epic/created.json';
import projectJSON from '../fixtures/webhooks/project/created.json';
import issueCreatedHook from '../fixtures/webhooks/issue/created.json';
import watchersBody from '../fixtures/jira-api-requests/watchers.json';
import projectData from '../fixtures/jira-api-requests/project.json';
import issueBodyJSON from '../fixtures/jira-api-requests/issue.json';
import { Jira } from '../../src/task-trackers/jira';
import {
    CreateRoomData,
    CreateRoomOpions,
    RoomViewStateEnum,
    Config,
    MilestoneStateEnum,
    DefaultLabel,
} from '../../src/types';
import { getDefaultErrorLog } from '../../src/lib/utils';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabCommentCreatedHook from '../fixtures/webhooks/gitlab/commented.json';
import gitlabProjectJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import milestoneIssuesJson from '../fixtures/gitlab-api-requests/milestone-issue.json';
import projectMembersJson from '../fixtures/gitlab-api-requests/project-members.json';
import gitlabIssueCreatedJson from '../fixtures/webhooks/gitlab/issue/created.json';
import gitlabLabelJson from '../fixtures/gitlab-api-requests/labels.json';
import { setSettingsData } from '../../src/bot/settings';
import { KeyType, milestonePart } from '../../src/task-trackers/gitlab/selectors';
import { translate } from '../../src/locales';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { GitlabLabel } from '../../src/task-trackers/gitlab/types';
import gitlabGroups from '../fixtures/gitlab-api-requests/groups.json';
import { getTaskTracker } from '../../src/task-trackers';

const { expect } = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    let chatClass;
    let chatApi;
    let createRoom: CreateRoom;
    const messengerLink = 'lalala';

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
        avatarUrl: messengerLink,
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
        chatClass = getChatClass({
            alias: [createRoomData.issue.key, createRoomData.projectKey!],
            roomId: [createRoomData.issue.key, createRoomData.projectKey!],
        });
        chatApi = chatClass.chatApiSingle;
        chatApi.uploadContent.resolves(messengerLink);
        const roomId = chatClass.getRoomData().id;

        createRoom = new CreateRoom(config, taskTracker, chatClass.chatApi);

        const roomCreatedMessage = translate('roomCreatedMessage', {
            link: taskTracker.createLink(chatApi.getRoomLink(roomId), translate('chat')),
        });

        nock(taskTracker.getRestUrl())
            // comment created hook
            .get(`/issue/${taskTracker.selectors.getIssueId(commentCreatedJSON)}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueBodyJSON.key}`)
            .reply(200, issueBodyJSON)
            .post(`/issue/${issueBodyJSON.key}/comment`, schemas.info(roomCreatedMessage))
            .reply(201)
            .get(`/issue/${notFoundUserIssueKey}`)
            .times(4)
            .reply(200, issueWithIncorrectCreator as any)
            .post(`/issue/${notFoundUserIssueKey}/comment`, schemas.info(roomCreatedMessage))
            .reply(201)
            .get(`/issue/${notFoundUserIssueKey}/watchers`)
            .reply(200, watchersBody)
            .get(`/issue/${notFoundUserIssueKey}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${createRoomData.issue.key}`)
            .times(3)
            .reply(200, issueBodyJSON)
            .post(`/issue/${issueKeyAvatar}/comment`, schemas.info(roomCreatedMessage))
            .reply(201)
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

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
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

            const result = await createRoom.run({ ...createRoomData, projectKey });
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
        const result = await createRoom.run({ issue: { key: notFoundUserIssueKey } });

        expect(result).to.be.true;
        expect(chatApi.createRoom).to.be.called;
    });

    it('Expect create room invite autoinviteUsers', async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const autoInviteuser = 'aa_invite';
        await setSettingsData(
            createRoomData.projectKey,
            {
                [issueBodyJSON.fields.issuetype.name]: [autoInviteuser],
            },
            'autoinvite',
        );
        const expectedOptions: CreateRoomOpions = {
            room_alias_name: issueBodyJSON.key,
            invite: [...new Set([...members, ...watchers, chatApi.getChatUserId(autoInviteuser)])],
            name: getChatClass().chatApiSingle.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
            topic: taskTracker.getViewUrl(issueBodyJSON.key),
            purpose: taskTracker.selectors.getSummary(issueBodyJSON),
            avatarUrl: undefined,
        };

        const result = await createRoom.run(createRoomData);

        expect(result).to.be.true;
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedOptions);
    });
    describe('Create Project features is empty', () => {
        beforeEach(() => {
            const configCreateProjectRoom: Config = pipe(
                clone,
                set('features.createProjectRoom', false),
            )(config) as Config;
            createRoom = new CreateRoom(configCreateProjectRoom, taskTracker, chatClass.chatApi);
        });

        it('Expect project and epic rooms should be created if Epic body we get and no rooms exists and createProjectRoom is Flase', async () => {
            chatApi.getRoomIdByName.reset();
            chatApi.getRoomIdByName.resolves(false);
            const result = await createRoom.run(taskTracker.parser.getCreateRoomData(epicJSON));
            expect(chatApi.createRoom).to.be.calledOnceWithExactly(expectedEpicRoomOptions);
            expect(result).to.be.true;
        });

        it('Expect project should be created if project_created hook we get and no project room exists and createProjectRoom is False', async () => {
            chatApi.getRoomId.throws();
            const result = await createRoom.run(taskTracker.parser.getCreateRoomData(projectJSON));
            expect(chatApi.createRoom).not.to.be.called;
            expect(result).to.be.true;
        });
    });
});

describe('Create room test with gitlab as task tracker', () => {
    let gitlabTracker: Gitlab;
    let chatApi;
    let createRoom: CreateRoom;
    let roomId;
    let chatClass;
    let gitlabConfig: Config;

    beforeEach(() => {
        gitlabConfig = pipe(
            clone,
            set('taskTracker', {
                type: 'gitlab',
                url: 'https://gitlab.test-example.ru',
                user: 'gitlab_bot',
                password: 'fakepasswprd',
            }),
        )(config) as Config;
        gitlabTracker = getTaskTracker(gitlabConfig) as Gitlab;
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Comment hook', () => {
        let createRoomData: CreateRoomData;
        beforeEach(() => {
            createRoomData = gitlabTracker.parser.getCreateRoomData(gitlabCommentCreatedHook);
            chatClass = getChatClass({
                alias: [createRoomData.issue.key, createRoomData.projectKey!],
                roomId: [createRoomData.issue.key, createRoomData.projectKey!],
            });
            chatApi = chatClass.chatApiSingle;
            createRoom = new CreateRoom(gitlabConfig, gitlabTracker, chatClass.chatApi);
            roomId = chatClass.getRoomData().id;
        });

        describe('Room is exists', () => {
            beforeEach(() => {
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects/${querystring.escape(gitlabCommentCreatedHook.project.path_with_namespace)}`)
                    .times(3)
                    .reply(200, gitlabProjectJson)
                    .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
                    .times(2)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectJson.id}/labels`)
                    .reply(200, gitlabLabelJson);
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
                    gitlabIssueJson.title +
                    ';' +
                    RoomViewStateEnum.open +
                    ';' +
                    gitlabCommentCreatedHook.project.path_with_namespace +
                    '/issues/' +
                    gitlabCommentCreatedHook.issue.iid +
                    ';' +
                    gitlabIssueJson.milestone.title +
                    ';';

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
                    .get(`/projects/${querystring.escape(gitlabCommentCreatedHook.project.path_with_namespace)}`)
                    .times(5)
                    .reply(200, gitlabProjectJson)
                    .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
                    .times(3)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectJson.id}/members/all`)
                    .reply(200, projectMembersJson)
                    .post(
                        `/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}/notes`,
                    )
                    .reply(201)
                    .get(`/projects/${gitlabProjectJson.id}/labels`)
                    .reply(200, gitlabLabelJson);
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
        const messengerLink = 'lalala';
        let chatFasade;
        beforeEach(() => {
            createRoomData = gitlabTracker.parser.getCreateRoomData(gitlabIssueCreatedJson);
            const milestoneKey = gitlabTracker.selectors.transformToKey(
                createRoomData.projectKey!,
                createRoomData.milestoneId!,
                KeyType.Milestone,
            );

            const chatClass = getChatClass({
                alias: [createRoomData.issue.key, createRoomData.projectKey!, milestoneKey],
                roomId: [createRoomData.issue.key, createRoomData.projectKey!, milestoneKey],
            });
            chatApi = chatClass.chatApiSingle;
            chatFasade = chatClass.chatApi;
            chatApi.uploadContent.resolves(messengerLink);
            createRoom = new CreateRoom(config, gitlabTracker, chatFasade);
            roomId = chatClass.getRoomData().id;
        });

        it('should return correct createRoomData', async () => {
            const expected: CreateRoomData = {
                issue: {
                    key:
                        gitlabIssueCreatedJson.project.path_with_namespace +
                        '-' +
                        gitlabIssueCreatedJson.object_attributes.iid,
                    descriptionFields: undefined,
                    hookLabels: gitlabIssueCreatedJson.labels,
                    projectKey: gitlabIssueCreatedJson.project.path_with_namespace,
                    summary: gitlabIssueCreatedJson.object_attributes.title,
                },
                projectKey: gitlabIssueCreatedJson.project.path_with_namespace,
                milestoneId: gitlabIssueCreatedJson.object_attributes.milestone_id,
            };
            expect(createRoomData).to.be.deep.eq(expected);
        });

        describe('Room is exists', () => {
            beforeEach(() => {
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects/${querystring.escape(gitlabIssueCreatedJson.project.path_with_namespace)}`)
                    .times(3)
                    .reply(200, gitlabProjectJson)
                    .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`)
                    .times(3)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectJson.id}/labels`)
                    .reply(200, gitlabLabelJson);
            });

            it('should not call create room if they are alredy exists', async () => {
                const result = await createRoom.run(createRoomData);
                expect(result).to.be.true;
                expect(chatApi.createRoom).not.to.be.called;
            });
        });

        describe('Room is not exists', () => {
            let expectedIssueRoomOptions: CreateRoomOpions;
            let expectedMilestoneRoomOptions: CreateRoomOpions;
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
                    gitlabIssueJson.title +
                    ';' +
                    RoomViewStateEnum.open +
                    ';' +
                    gitlabIssueCreatedJson.project.path_with_namespace +
                    '/issues/' +
                    gitlabIssueCreatedJson.object_attributes.iid +
                    ';' +
                    gitlabIssueJson.milestone.title +
                    ';';

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

                const milestoneKey = milestonePart + gitlabIssueJson.milestone.id;
                const milestoneMembers = [gitlabIssueJson.assignee.username].map(name =>
                    getChatClass().chatApiSingle.getChatUserId(name),
                );

                const milestoneRoomName =
                    '#' +
                    gitlabIssueJson.milestone.id +
                    ';' +
                    gitlabIssueJson.milestone.title +
                    ';' +
                    MilestoneStateEnum.open +
                    ';' +
                    gitlabIssueJson.milestone.web_url.replace('https://gitlab.example.com/', '').replace('/-', '') +
                    ';';

                expectedMilestoneRoomOptions = {
                    invite: milestoneMembers,
                    name: milestoneRoomName,
                    room_alias_name: milestoneKey,
                    topic: gitlabIssueJson.milestone.web_url,
                    purpose: gitlabIssueJson.milestone.title,
                };
                nock(gitlabTracker.getRestUrl())
                    .get(`/projects/${querystring.escape(gitlabIssueCreatedJson.project.path_with_namespace)}`)
                    // .times(5)
                    .reply(200, gitlabProjectJson)
                    .get(
                        `/groups/${gitlabIssueJson.milestone.group_id}/milestones/${gitlabIssueJson.milestone.id}/issues`,
                    )
                    .reply(200, milestoneIssuesJson)
                    .get(`/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`)
                    // .times(4)
                    .reply(200, gitlabIssueJson)
                    .get(`/projects/${gitlabProjectJson.id}/members/all`)
                    .reply(200, projectMembersJson)
                    .get(`/groups`)
                    .times(2)
                    .query({ search: gitlabProjectJson.namespace.path })
                    .reply(200, gitlabGroups)
                    .post(
                        `/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}/notes`,
                    )
                    .reply(201);
            });

            it('should call room creation with no avatar', async () => {
                chatApi.getRoomIdByName.reset();
                chatApi.getRoomIdByName.resolves(false);
                const result = await createRoom.run(createRoomData);
                expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
                expect(chatApi.createRoom).to.be.calledWithExactly(expectedMilestoneRoomOptions);
                expect(result).to.be.true;
            });

            describe('config color projects is set to "all"', () => {
                let noLabellData;
                const unsortedLabel: GitlabLabel = {
                    id: 306,
                    name: 'unsorted',
                    color: '#999999',
                    description: null,
                    description_html: '',
                    text_color: '#FFFFFF',
                    subscribed: false,
                    priority: null,
                    is_project_label: true,
                };
                const giltabLabelsWithUnsorted = [...gitlabLabelJson, unsortedLabel];

                beforeEach(() => {
                    const noLabelIssueHook = pipe(clone, set('labels', []))(gitlabIssueCreatedJson);
                    noLabellData = gitlabTracker.parser.getCreateRoomData(noLabelIssueHook);
                    chatApi.getRoomIdByName.reset();
                    chatApi.getRoomIdByName.resolves(false);
                    const configAllProjectsColors: Config = pipe(
                        clone,
                        set('colors.projects', 'all'),
                    )(gitlabConfig) as Config;
                    createRoom = new CreateRoom(configAllProjectsColors, gitlabTracker, chatFasade);
                });

                it('should call room creation with avatar if ', async () => {
                    const result = await createRoom.run(createRoomData);
                    expect(chatApi.createRoom).to.be.calledWithExactly({
                        ...expectedIssueRoomOptions,
                        avatarUrl: messengerLink,
                    });
                    expect(result).to.be.true;
                });

                it('should call room creation with DEFAULT avatar and send message "LABEL NOT INSTALL" if issue have no Llabel and config has no default label', async () => {
                    const result = await createRoom.run(noLabellData);
                    expect(chatApi.createRoom).to.be.calledWithExactly({
                        ...expectedIssueRoomOptions,
                        avatarUrl: messengerLink,
                    });
                    expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(
                        roomId,
                        translate('issueLabelNotExist'),
                        translate('issueLabelNotExist'),
                    );
                    expect(result).to.be.true;
                });

                describe('Config includes default label', () => {
                    const defaultLabel: DefaultLabel = {
                        // color: 'purple',
                        // description: 'default label',
                        name: unsortedLabel.name,
                    };
                    beforeEach(() => {
                        const configAllProjectsColors: Config = pipe(
                            clone,
                            set('colors.projects', 'all'),
                            set('taskTracker.defaultLabel', defaultLabel),
                        )(gitlabConfig) as Config;

                        const gitlabTracker = getTaskTracker(configAllProjectsColors) as Gitlab;
                        const chatClass = getChatClass({
                            alias: [createRoomData.issue.key, createRoomData.projectKey!],
                            roomId: [createRoomData.issue.key, createRoomData.projectKey!],
                        });
                        chatApi = chatClass.chatApiSingle;
                        const chatFasade = chatClass.chatApi;
                        chatApi.uploadContent.resolves(messengerLink);
                        chatApi.getRoomIdByName.reset();
                        chatApi.getRoomIdByName.resolves(false);

                        createRoom = new CreateRoom(configAllProjectsColors, gitlabTracker, chatFasade);
                    });

                    it('should call room creation with UNSORTED label if group has such label', async () => {
                        nock(gitlabTracker.getRestUrl())
                            .get(`/groups/${gitlabProjectJson.namespace.id}/labels`)
                            .query({ per_page: 100 })
                            .reply(200, giltabLabelsWithUnsorted)
                            .put(
                                `/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`,
                            )
                            .query({ labels: defaultLabel.name })
                            .reply(200);

                        const result = await createRoom.run(noLabellData);
                        expect(chatApi.createRoom).to.be.calledWithExactly({
                            ...expectedIssueRoomOptions,
                            avatarUrl: messengerLink,
                        });
                        expect(chatApi.sendHtmlMessage).not.to.be.calledWithExactly(
                            roomId,
                            translate('issueLabelNotExist'),
                            translate('issueLabelNotExist'),
                        );
                        expect(result).to.be.true;
                    });

                    it('should call room creation with sending INFO if group doesnt have such label', async () => {
                        nock(gitlabTracker.getRestUrl())
                            .get(`/groups/${gitlabProjectJson.namespace.id}/labels`)
                            .query({ per_page: 100 })
                            .reply(200, gitlabLabelJson);
                        // .post(`/groups/${gitlabProjectJson.namespace.id}/labels`, defaultLabel as any)
                        // .reply(201)

                        // .put(
                        //     `/projects/${gitlabProjectJson.id}/issues/${gitlabIssueCreatedJson.object_attributes.iid}`,
                        // )
                        // .query({ labels: defaultLabel.name })
                        // .reply(200);

                        const result = await createRoom.run(noLabellData);
                        expect(chatApi.createRoom).to.be.calledWithExactly({
                            ...expectedIssueRoomOptions,
                            avatarUrl: messengerLink,
                        });
                        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(
                            roomId,
                            translate('issueLabelNotExist'),
                            translate('issueLabelNotExist'),
                        );
                        expect(result).to.be.true;
                    });
                });
            });
        });
    });
});
