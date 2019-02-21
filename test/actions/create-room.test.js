const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const epicJSON = require('../fixtures/webhooks/epic/created.json');
const projectJSON = require('../fixtures/webhooks/project/created.json');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/created.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const projectData = require('../fixtures/jira-api-requests/project.json');
const createRoom = require('../../src/bot/actions/create-room.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    const watchers = watchersBody.watchers.map(({name}) => utils.getChatUserId(name));
    const errorMsg = 'some error';

    const createRoomData = getCreateRoomData(JSONbody);

    const projectKey = epicJSON.issue.fields.project.key;

    const expectedEpicRoomOptions = {
        'room_alias_name': epicJSON.issue.key,
        'invite': [utils.getChatUserId(epicJSON.user.name), ...watchers],
        'name': utils.composeRoomName(epicJSON.issue.key, epicJSON.issue.fields.summary),
        'topic': utils.getViewUrl(epicJSON.issue.key),
    };

    const expectedIssueRoomOptions = {
        'room_alias_name': createRoomData.issue.key,
        'invite': [utils.getChatUserId(JSONbody.user.name), ...watchers],
        'name': utils.composeRoomName(createRoomData.issue.key, createRoomData.issue.summary),
        'topic': utils.getViewUrl(createRoomData.issue.key),
    };

    const expectedEpicProjectOptions = {
        'room_alias_name': projectKey,
        'invite': [utils.getChatUserId(projectData.lead.key)],
        'name': utils.composeRoomName(projectData.key, projectData.name),
        'topic': utils.getViewUrl(projectKey),
    };

    const expectedCreateProjectOptions = {
        'room_alias_name': projectJSON.project.key,
        'invite': [utils.getChatUserId(projectData.lead.key)],
        'name': utils.composeRoomName(projectData.key, projectData.name),
        'topic': utils.getViewUrl(projectJSON.project.key),
    };

    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub().resolves('id'),
        createRoom: stub().resolves('correct room'),
    };


    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${createRoomData.issue.key}/watchers`)
            .times(5)
            .reply(200, watchersBody)
            .get(`/issue/${epicJSON.issue.key}/watchers`)
            .reply(200, watchersBody)
            .get(`/project/${projectKey}`)
            .times(2)
            .reply(200, projectData)
            .get(`/project/${JSONbody.issue.fields.project.key}`)
            .times(2)
            .reply(200, projectData)
            .get(`/project/${projectJSON.project.key}`)
            .reply(200, projectData)
            .get(`/issue/${createRoomData.issue.id}`)
            .query(utils.expandParams)
            .times(5)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${epicJSON.issue.id}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect issue room and project room should not be created if we run simple issue_created', async () => {
        const result = await createRoom({chatApi, ...createRoomData});
        expect(result).to.be.true;
        expect(chatApi.createRoom).not.to.be.called;
    });

    it('Expect room should be created if it\'s not exists and project creates if we run simple issue_created', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({chatApi, ...createRoomData});
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedIssueRoomOptions);
        expect(result).to.be.true;
    });

    it('Expect project and epic rooms should be created if Epic body we get and no rooms exists', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({chatApi, ...getCreateRoomData(epicJSON)});
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicRoomOptions);
        expect(chatApi.createRoom).to.be.calledWithExactly(expectedEpicProjectOptions);
        expect(result).to.be.true;
    });

    it('Expect project should be created if project_created hook we get and no project room exists', async () => {
        chatApi.getRoomId.throws();
        const result = await createRoom({chatApi, ...getCreateRoomData(projectJSON)});
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
            res = await createRoom({chatApi, ...createRoomData});
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

            const result = await createRoom({chatApi, ...createRoomData, projectKey});
            expect(result).not.to.be;
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });
});
