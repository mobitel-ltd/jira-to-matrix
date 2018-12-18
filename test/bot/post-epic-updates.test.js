const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/comment-create-2.json');
const {getPostEpicUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {cleanRedis} = require('../fixtures/testing-utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const sismemberAsyncStub = stub();
const saddAsyncStub = stub();
const redisStub = {
    sismemberAsync: sismemberAsyncStub,
    saddAsync: saddAsyncStub,
};

const proxyquire = require('proxyquire');

const postEpicUpdates = proxyquire('../../src/bot/post-epic-updates.js', {
    '../redis-client': redisStub,
});


describe('Post epic updates test', () => {
    const responce = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/10002',
        key: 'EX-1',
        fields: {
            summary: 'SummaryKey',
        },
    };
    const sendHtmlMessageStub = stub();
    const getRoomIdStub = stub();

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
    };

    const expectedData = [
        'roomIdBBCOM-801',
        'Новая задача в эпике',
        '<p>К эпику добавлена задача <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">BBCOM-956 BBCOM-956</a></p>\n',
    ];

    const postCommentData = getPostEpicUpdatesData(JSONbody);

    before(() => {
        nock('https://jira.test-example.ru', {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/jira/rest/api/2/issue/BBCOM-801`)
            .times(7)
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    afterEach(() => {
        getRoomIdStub.reset();
        sendHtmlMessageStub.reset();
        sismemberAsyncStub.reset();
        saddAsyncStub.reset();
    });

    it('Expect postEpicUpdates throw error "No roomId for" if room is not exists', async () => {
        getRoomIdStub.rejects('No roomId for');
        try {
            await postEpicUpdates({mclient, ...postCommentData});
        } catch (err) {
            expect(err.includes('No roomId for')).to.be.true;
        }
    });

    it('Get true after running postEpicUpdates', async () => {
        getRoomIdStub.callsFake(id => (id ? `roomId${id}` : null));
        const result = await postEpicUpdates({mclient, ...postCommentData});

        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postCommentData, issueID: null};

        try {
            await postEpicUpdates({mclient, ...newBody});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in get issue',
                'Error in request https://jira.test-example.ru/jira/rest/api/2/issue/BBCOM-801',
                'requestError: request to https://jira.test-example.ru/jira/rest/api/2/issue/BBCOM-801 failed, reason: Nock: No match for request {',
            ].join('\n');
            expect(err).to.include(expected);
        }
    });

    it('Redis error in isInEpic', async () => {
        sismemberAsyncStub.throws('Error in sismemberAsync!!!');

        try {
            await postEpicUpdates({mclient, ...postCommentData});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in postNewIssue',
                'Error while querying redis',
                'Error in sismemberAsync!!!',
            ].join('\n');
            expect(err).to.deep.equal(expected);
        }
    });

    it('Epic key is in redis', async () => {
        sismemberAsyncStub.returns('Ok');
        getRoomIdStub.callsFake(id => (id ? `roomId${id}` : null));

        const result = await postEpicUpdates({mclient, ...postCommentData});
        expect(sendHtmlMessageStub).not.to.be.called;
        expect(result).to.be.true;
    });

    it('Redis error in isInEpic', async () => {
        saddAsyncStub.throws('Error in saddAsyncStub!!!');

        try {
            await postEpicUpdates({mclient, ...postCommentData});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in postNewIssue',
                'Redis error while adding issue to epic',
                'Error in saddAsyncStub!!!',
            ].join('\n');
            expect(err).to.deep.equal(expected);
        }
    });

    afterEach(async () => {
        await cleanRedis();
    });
});
