const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/create.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const issueBody = require('../fixtures/response.json');
const proxyquire = require('proxyquire');
const projectData = require('../fixtures/project-example.json');
const {jira: {url}} = require('../../src/config');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const postIssueDescriptionStub = stub().callsFake();
const createRoom = proxyquire('../../src/bot/create-room.js', {
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
    const privatePath = '/rest/api/2/issue/private/watchers';

    before(() => {
        nock(url, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get('/rest/api/2/issue/BBCOM-1398/watchers')
            .times(5)
            .reply(200, {...responce, id: 28516})
            .get(`/rest/api/2/issue/30369?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(`/rest/api/2/project/10305`)
            .times(5)
            .reply(200, projectData)
            .get(`/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404)
            .get(privatePath)
            .reply(404);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Room should not be created', async () => {
        const result = await createRoom({mclient, ...createRoomData});
        expect(createRoomStub).not.to.be.called;
        expect(result).to.be.true;
    });

    it('Room should be created', async () => {
        getRoomIdStub.returns(null);
        const result = await createRoom({mclient, ...createRoomData});
        expect(createRoomStub).to.be.called.calledWithExactly(expectedOptions);
        expect(postIssueDescriptionStub).to.be.called;
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
            const expectedError = [
                'Error in room creating',
                'createRoomProject Error',
                'Error createRoomProject',
            ].join('\n');
            expect(err).to.be.deep.equal(expectedError);
        }
    });
});
