const nock = require('nock');
const {composeRoomName, auth, getDefaultErrorLog, issueFormatedParams, getRestUrl, getIssueProjectOpts, getViewUrl} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/create.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const issueBody = require('../fixtures/response.json');
const proxyquire = require('proxyquire');
const projectData = require('../fixtures/project-example.json');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const postIssueDescriptionStub = stub();
const createRoom = proxyquire('../../src/bot/create-room.js', {
    './post-issue-description.js': postIssueDescriptionStub,
});

describe('Create room test', () => {
    const errorMsg = 'some error';

    const createRoomData = getCreateRoomData(JSONbody);

    const projectOpts = getIssueProjectOpts(JSONbody);

    const responce = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/10002',
        key: 'EpicKey',
        fields: {
            summary: 'SummaryKey',
        },
    };

    const expectedOptions = {
        'room_alias_name': createRoomData.issue.key,
        'invite': ['@jira_test:matrix.test-example.ru'],
        'name': composeRoomName(createRoomData.issue),
        'topic': getViewUrl(createRoomData.issue.key),
    };

    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub().resolves('id'),
        createRoom: stub().resolves('correct room'),
    };


    before(() => {
        nock(getRestUrl(), {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/issue/${createRoomData.issue.key}/watchers`)
            .times(5)
            .reply(200, {...responce, id: 28516})
            .get(`/issue/${createRoomData.issue.id}`)
            .query(issueFormatedParams)
            .times(5)
            .reply(200, issueBody)
            .get(`/project/${projectOpts.id}`)
            .times(5)
            .reply(200, projectData)
            .get(`/issue/BBCOM-801`)
            .query(issueFormatedParams)
            .times(5)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
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
        expect(mclient.createRoom).to.be.called.calledWithExactly(expectedOptions);
        expect(postIssueDescriptionStub).to.be.called;
        expect(result).to.be.true;
    });

    it('Issue room and project room should not be created', async () => {
        mclient.getRoomId.withArgs(projectOpts.key).resolves(true);
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
        expect(result).to.be.true;
    });

    it('Project room should be created', async () => {
        const expectedProjectOptions = {
            'room_alias_name': 'EX',
            'invite': ['@fred:matrix.test-example.ru'],
            'name': 'Example',
            'topic': 'https://jira.test-example.ru/jira/projects/EX',
        };

        mclient.getRoomId.withArgs(projectOpts.key).resolves(false);
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
        expect(mclient.createRoom).to.be.calledWithExactly(expectedProjectOptions);
        expect(result).to.be.true;
    });

    it('Get error in room create', async () => {
        mclient.createRoom.throws(errorMsg);
        try {
            const result = await createRoom({mclient, ...createRoomData});
            expect(result).not.to.be;
        } catch (err) {
            const expectedError = [
                getDefaultErrorLog('create room'),
                getDefaultErrorLog('createIssueRoom'),
                errorMsg,
            ].join('\n');
            expect(err).to.be.deep.equal(expectedError);
        }
    });

    it('Get error in room createRoomProject', async () => {
        mclient.createRoom.resetBehavior();

        mclient.createRoom.throws(errorMsg);
        try {
            mclient.getRoomId.callsFake(id => !(id === projectOpts.key));

            const result = await createRoom({mclient, ...createRoomData, projectOpts});
            expect(result).not.to.be;
        } catch (err) {
            const expectedError = [
                getDefaultErrorLog('create room'),
                getDefaultErrorLog('createRoomProject'),
                errorMsg,
            ].join('\n');
            expect(err).to.be.deep.equal(expectedError);
        }
    });
});
