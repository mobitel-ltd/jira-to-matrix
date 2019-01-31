const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const epicJSON = require('../fixtures/webhooks/epic/created.json');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/created.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const projectData = require('../fixtures/jira-api-requests/project.json');
const createRoom = require('../../src/bot/create-room.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    const watchers = watchersBody.watchers.map(({name}) => utils.getMatrixUserID(name));
    const errorMsg = 'some error';

    const createRoomData = getCreateRoomData(JSONbody);

    const projectKey = utils.getProjectKey(epicJSON);

    const expectedEpicRoomOptions = {
        'room_alias_name': epicJSON.issue.key,
        'invite': [utils.getMatrixUserID(epicJSON.user.name), ...watchers],
        'name': utils.composeRoomName({key: epicJSON.issue.key, summary: epicJSON.issue.fields.summary}),
        'topic': utils.getViewUrl(epicJSON.issue.key),
    };

    const expectedRoomOptions = {
        'room_alias_name': createRoomData.issue.key,
        'invite': [utils.getMatrixUserID(JSONbody.user.name), ...watchers],
        'name': utils.composeRoomName(createRoomData.issue),
        'topic': utils.getViewUrl(createRoomData.issue.key),
    };
    const expectedProjectOptions = {
        'room_alias_name': projectData.key,
        'invite': [utils.getMatrixUserID(projectData.lead.key)],
        'name': projectData.name,
        'topic': utils.getViewUrl(projectData.key),
    };

    const mclient = {
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
            .times(5)
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
        Object.values(mclient).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Room should not be created', async () => {
        const result = await createRoom({mclient, ...createRoomData});
        expect(mclient.createRoom).not.to.be.called;
        expect(result).to.be.true;
    });

    it('Room should be created', async () => {
        mclient.getRoomId.throws('No room');
        const result = await createRoom({mclient, ...createRoomData});
        expect(mclient.createRoom).to.be.calledWithExactly(expectedRoomOptions);
        expect(result).to.be.true;
    });

    it('Issue room and project room should not be created', async () => {
        mclient.getRoomId.withArgs(projectKey).resolves('id');
        const result = await createRoom({mclient, ...createRoomData, projectKey});
        expect(result).to.be.true;
    });

    it('Project and epic rooms should be created if Epic body we get and no rooms exists', async () => {
        mclient.getRoomId.throws();
        const roomData = getCreateRoomData(epicJSON);
        const result = await createRoom({mclient, ...roomData});
        expect(mclient.createRoom).to.be.calledWithExactly(expectedEpicRoomOptions);
        expect(mclient.createRoom).to.be.calledWithExactly(expectedProjectOptions);
        expect(result).to.be.true;
    });

    it('Get error in room create', async () => {
        mclient.createRoom.throws(errorMsg);
        let res;
        const expectedError = [
            utils.getDefaultErrorLog('create room'),
            utils.getDefaultErrorLog('createIssueRoom'),
            errorMsg,
        ].join('\n');

        try {
            res = await createRoom({mclient, ...createRoomData});
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });

    it('Get error in room createRoomProject', async () => {
        mclient.createRoom.resetBehavior();
        mclient.createRoom.throws(errorMsg);
        let res;
        const expectedError = [
            utils.getDefaultErrorLog('create room'),
            utils.getDefaultErrorLog('createProjectRoom'),
            errorMsg,
        ].join('\n');

        try {
            mclient.getRoomId.callsFake(id => !(id === projectKey));

            const result = await createRoom({mclient, ...createRoomData, projectKey});
            expect(result).not.to.be;
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });
});
