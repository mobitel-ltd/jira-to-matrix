const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const { getCreateRoomData } = require('../../src/jira-hook-parser/parse-body.js');
const createRoom = require('../../src/bot/actions/create-room.js');
const config = require('../../src/config');

const commentCreatedJSON = require('../fixtures/webhooks/comment/created.json');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const epicJSON = require('../fixtures/webhooks/epic/created.json');
const projectJSON = require('../fixtures/webhooks/project/created.json');
const JSONbody = require('../fixtures/webhooks/issue/created.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const projectData = require('../fixtures/jira-api-requests/project.json');
const issueBodyJSON = require('../fixtures/jira-api-requests/issue.json');
const testUtils = require('../test-utils');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    let chatApi = testUtils.getChatApi();
    const members = [
        issueBodyJSON.fields.reporter.name,
        issueBodyJSON.fields.creator.name,
        issueBodyJSON.fields.assignee.name,
    ].map(name => chatApi.getChatUserId(name));

    // colors INDEV-749
    const [projectForAvatar] = config.colors.projects;
    const issueKeyAvatar = `${projectForAvatar}-123`;

    const watchers = watchersBody.watchers.map(({ name }) => chatApi.getChatUserId(name));
    const errorMsg = 'some error';

    const createRoomData = getCreateRoomData(JSONbody);

    const projectKey = epicJSON.issue.fields.project.key;

    const expectedEpicRoomOptions = {
        room_alias_name: epicJSON.issue.key,
        invite: [...new Set([...members, ...watchers])],
        name: chatApi.composeRoomName(epicJSON.issue.key, epicJSON.issue.fields.summary),
        topic: utils.getViewUrl(epicJSON.issue.key),
        purpose: utils.getSummary(epicJSON),
        avatarUrl: undefined,
    };

    const expectedIssueRoomOptions = {
        room_alias_name: createRoomData.issue.key,
        invite: [...new Set([...members, ...watchers])],
        name: chatApi.composeRoomName(createRoomData.issue.key, createRoomData.issue.summary),
        topic: utils.getViewUrl(createRoomData.issue.key),
        purpose: createRoomData.issue.summary,
        avatarUrl: undefined,
    };

    const expectedIssueRoomOptionsNoSummary = {
        room_alias_name: issueBodyJSON.key,
        invite: [...new Set([...members, ...watchers])],
        name: chatApi.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
        topic: utils.getViewUrl(issueBodyJSON.key),
        purpose: issueBodyJSON.fields.summary,
        avatarUrl: undefined,
    };

    const expectedIssueAvatar = {
        room_alias_name: issueKeyAvatar,
        invite: [...new Set([...members, ...watchers])],
        name: chatApi.composeRoomName(issueKeyAvatar, issueBodyJSON.fields.summary),
        topic: utils.getViewUrl(issueKeyAvatar),
        purpose: issueBodyJSON.fields.summary,
        avatarUrl: config.colors.links.issue,
    };

    const expectedEpicProjectOptions = {
        room_alias_name: projectKey,
        invite: [chatApi.getChatUserId(projectData.lead.key)],
        name: chatApi.composeRoomName(projectData.key, projectData.name),
        topic: utils.getViewUrl(projectKey),
    };

    const expectedCreateProjectOptions = {
        room_alias_name: projectJSON.project.key,
        invite: [chatApi.getChatUserId(projectData.lead.key)],
        name: chatApi.composeRoomName(projectData.key, projectData.name),
        topic: utils.getViewUrl(projectJSON.project.key),
    };

    beforeEach(() => {
        chatApi = testUtils.getChatApi({ alias: [createRoomData.issue.key, createRoomData.projectKey] });
        nock(utils.getRestUrl())
            // comment created hook
            .get(`/issue/${utils.getIssueId(commentCreatedJSON)}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueBodyJSON.key}`)
            .reply(200, issueBodyJSON)
            .get(`/issue/${createRoomData.issue.key}`)
            .times(3)
            .reply(200, issueBodyJSON)
            .get(`/issue/${issueBodyJSON.key}/watchers`)
            .reply(200, watchersBody)
            .get(`/issue/${issueBodyJSON.key}`)
            .query(utils.expandParams)
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
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${epicJSON.issue.key}/watchers`)
            .reply(200, watchersBody)
            .get(`/project/${projectKey}`)
            .reply(200, projectData)
            .get(`/project/${JSONbody.issue.fields.project.key}`)
            .reply(200, projectData)
            .get(`/project/${projectJSON.project.key}`)
            .reply(200, projectData)
            .get(`/issue/${createRoomData.issue.key}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${epicJSON.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${epicJSON.issue.key}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect both issue room and project room not to be created if we run simple issue_created and both chat room exists in chat', async () => {
        const result = await createRoom({ chatApi, ...createRoomData });
        expect(result).to.be.true;
        expect(chatApi.createRoom).not.to.be.called;
    });

    it("Expect room should be created if it's not exists and project creates if we run simple issue_created", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom({ chatApi, ...createRoomData });
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
        expect(result).to.be.true;
    });

    it('Expect project and epic rooms should be created if Epic body we get and no rooms exists', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({ chatApi, ...getCreateRoomData(epicJSON) });
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicRoomOptions);
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicProjectOptions);
        expect(result).to.be.true;
    });

    it('Expect project should be created if project_created hook we get and no project room exists', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({ chatApi, ...getCreateRoomData(projectJSON) });
        expect(chatApi.createRoom).to.be.calledOnceWithExactly(expectedCreateProjectOptions);
        expect(result).to.be.true;
    });

    it('Expect error in room create throws error', async () => {
        chatApi.createRoom.throws(errorMsg);
        let res;
        const expectedError = [
            utils.getDefaultErrorLog('create room'),
            utils.getDefaultErrorLog('createIssueRoom'),
            errorMsg,
        ].join('\n');

        try {
            res = await createRoom({ chatApi, ...getCreateRoomData(epicJSON) });
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });

    it('Expect error in room createRoomProject throw error', async () => {
        chatApi.createRoom.throws(errorMsg);
        let res;
        const expectedError = [
            utils.getDefaultErrorLog('create room'),
            utils.getDefaultErrorLog('createProjectRoom'),
            errorMsg,
        ].join('\n');

        try {
            chatApi.getRoomId.callsFake(id => !(id === projectKey));

            const result = await createRoom({ chatApi, ...createRoomData, projectKey });
            expect(result).not.to.be;
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });

    it('Expect room created if we get create_comment hook', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({ chatApi, ...getCreateRoomData(commentCreatedJSON) });

        expect(chatApi.createRoom).to.be.calledWithExactly({
            room_alias_name: issueBodyJSON.key,
            // beacause watchers are includes issue assigne in this case
            invite: [...new Set([...members, ...watchers])],
            name: chatApi.composeRoomName(issueBodyJSON.key, issueBodyJSON.fields.summary),
            topic: utils.getViewUrl(issueBodyJSON.key),
            purpose: issueBodyJSON.fields.summary,
            avatarUrl: undefined,
        });
        expect(result).to.be.true;
    });

    it("Expect room should be created if it's not exists and project creates if we run create room with only key", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom({ chatApi, issue: { key: createRoomData.issue.key } });
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptionsNoSummary);
        expect(result).to.be.true;
    });

    it("Expect room should be created if it's not exists with avatar url if no project is in the config list colors", async () => {
        chatApi.getRoomIdByName.reset();
        chatApi.getRoomIdByName.resolves(false);
        const result = await createRoom({ chatApi, issue: { key: issueKeyAvatar } });

        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueAvatar);
        expect(result).to.be.true;
    });
});
