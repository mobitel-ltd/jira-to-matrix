const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/create.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const issueBody = require('../fixtures/response.json');
const proxyquire = require('proxyquire');
const projectData = require('../fixtures/project-example.json');

const chai = require('chai');
const {stub, spy} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const loggerSpy = {
    error: spy(),
    warn: spy(),
    debug: spy(),
    info: spy(),
};
const postIssueDescriptionStub = stub().callsFake();
const createRoom = proxyquire('../../src/bot/create-room.js', {
    '../modules/log.js': () => loggerSpy,
    './post-issue-description.js': postIssueDescriptionStub,
});

describe('Create room test', () => {
    const responce = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/10002',
        key: 'EpicKey',
        fields: {
            summary: 'SummaryKey',
        },
    };

    const expectedOptions = {
        'room_alias_name': 'BBCOM-1398',
        'invite': ['@jira_test:matrix.test-example.ru'],
        'name': 'BBCOM-1398 Test',
        'topic': 'https://jira.test-example.ru/jira/browse/BBCOM-1398',
    };

    const sendHtmlMessageStub = stub();
    const getRoomIdStub = stub().returns('id');
    const createRoomStub = stub().returns('correct room');

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
        createRoom: createRoomStub,
    };

    const createRoomData = getCreateRoomData(JSONbody);

    before(() => {
        nock('https://jira.test-example.ru', {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
            .times(5)
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(`/jira/rest/api/2/project/10305`)
            .times(5)
            .reply(200, projectData)
            .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Room should not be created', async () => {
        const result = await createRoom({mclient, ...createRoomData});
        expect(createRoomStub).not.to.be.called;
        expect(loggerSpy.debug).to.have.been.calledWithExactly('Room should not be created');
        expect(loggerSpy.debug).to.have.been.calledWithExactly('Room for a project not created as projectOpts is undefined');
        expect(result).to.be.true;
    });

    it('Room should be created', async () => {
        getRoomIdStub.returns(null);
        const result = await createRoom({mclient, ...createRoomData});
        expect(loggerSpy.debug).to.have.been
            .calledWithExactly(`Start creating the room for issue ${createRoomData.issue.key}`);
        expect(createRoomStub).to.be.called.calledWithExactly(expectedOptions);
        expect(loggerSpy.info).to.have.been
            .calledWithExactly(`Created room for ${createRoomData.issue.key}: correct room`);
        expect(postIssueDescriptionStub).to.be.called;
        expect(loggerSpy.debug).to.have.been.calledWithExactly('Room for a project not created as projectOpts is undefined');
        expect(result).to.be.true;
    });

    it('Issue room and project room should not be created', async () => {
        const projectOpts = {
            'id': '10305',
            'key': 'BBCOM',
            'name': 'BB Common',
        };
        getRoomIdStub.withArgs('BBCOM').returns(true);
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
        expect(loggerSpy.debug).to.have.been.calledWithExactly('Room for project BBCOM is already exists');
        expect(result).to.be.true;
    });

    it('Project room should be created', async () => {
        const expectedProjectOptions = {
            'room_alias_name': 'EX',
            'invite': ['@fred:matrix.test-example.ru'],
            'name': 'Example',
            'topic': 'https://jira.test-example.ru/jira/projects/EX',
        };

        getRoomIdStub.withArgs('BBCOM').returns(false);
        const projectOpts = {
            'id': '10305',
            'key': 'BBCOM',
            'name': 'BB Common',
        };
        const result = await createRoom({mclient, ...createRoomData, projectOpts});
        expect(loggerSpy.debug).to.have.been.calledWithExactly('Try to create a room for project BBCOM');
        expect(createRoomStub).to.be.calledWithExactly(expectedProjectOptions);
        expect(result).to.be.true;
    });

    it('Get error in room create', async () => {
        createRoomStub.throws('Error createRoomStub');
        try {
            const result = await createRoom({mclient, ...createRoomData});
            expect(result).not.to.be;
        } catch (err) {
            const expectedError = [
                'Error in room creating',
                'Error in room create',
                'Error createRoomStub',
            ].join('\n');
            expect(err).to.be.deep.equal(expectedError);
        }
    });

    it('Get error in room createRoomProject', async () => {
        createRoomStub.resetBehavior();

        createRoomStub.throws('Error createRoomProject');
        try {
            const projectOpts = {
                'id': '10305',
                'key': 'BBCOM',
                'name': 'BB Common',
            };
            getRoomIdStub.callsFake(id => !(id === 'BBCOM'));

            const result = await createRoom({mclient, ...createRoomData, projectOpts});
            expect(result).not.to.be;
        } catch (err) {
            expect(loggerSpy.debug).to.have.been.calledWithExactly('Room should not be created');
            const expectedError = [
                'Error in room creating',
                'createRoomProject Error',
                'Error createRoomProject',
            ].join('\n');
            expect(err).to.be.deep.equal(expectedError);
        }
    });
});
