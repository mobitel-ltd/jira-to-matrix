const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
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

    const projectOpts = utils.getIssueProjectOpts(JSONbody);

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
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .get(`/issue/${createRoomData.issue.key}/watchers`)
            .times(5)
            .reply(200, watchersBody)
            .get(`/project/${projectOpts.id}`)
            .times(5)
            .reply(200, projectData)
            .get(`/issue/${createRoomData.issue.id}`)
            .query(utils.expandParams)
            .times(5)
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
        mclient.getRoomId.resolves(null);
        const result = await createRoom({mclient, ...createRoomData});
        expect(mclient.createRoom).to.be.called.calledWithExactly(expectedRoomOptions);
        expect(result).to.be.true;
    });

    it('Issue room and project room should not be created', async () => {
        mclient.getRoomId.withArgs(projectOpts.key).resolves(true);
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
        expect(result).to.be.true;
    });

    it('Project room should be created', async () => {
        mclient.getRoomId.withArgs(projectOpts.key).resolves(false);
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
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
            utils.getDefaultErrorLog('createRoomProject'),
            errorMsg,
        ].join('\n');

        try {
            mclient.getRoomId.callsFake(id => !(id === projectOpts.key));

            const result = await createRoom({mclient, ...createRoomData, projectOpts});
            expect(result).not.to.be;
        } catch (err) {
            res = err;
        }
        expect(res).to.be.deep.equal(expectedError);
    });
});
