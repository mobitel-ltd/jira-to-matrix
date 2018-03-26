const nock = require('nock');
const {auth} = require('../../src/jira/common');
const JSONbody = require('../fixtures/comment-create-2.json');
const {getPostEpicUpdatesData} = require('../../src/queue/parse-body.js');
const {isPostEpicUpdates} = require('../../src/queue/bot-handler.js');
const redis = require('../../src/redis-client.js');
const {redis: {prefix}} = require('../fixtures/config.js');

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
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };
    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});
    const getRoomIdStub = stub();

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
    };

    const expectedData = [
        'roomIdBBCOM-801',
        'Новая задача в эпике',
        '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 BBCOM-956</a></p>\n',
    ];

    const postCommentData = getPostEpicUpdatesData(JSONbody);

    before(() => {
        const {epicKey} = postCommentData;
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/BBCOM-801`)
            .times(6)
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Get undefined with no room for epicKey', async () => {
        getRoomIdStub.callsFake(() => {});
        const result = await postEpicUpdates({mclient, ...postCommentData});

        expect(result).to.be.undefined;
    });

    it('Get true after running postEpicUpdates', async () => {
        getRoomIdStub.reset();
        getRoomIdStub.callsFake(id => id ? `roomId${id}` : null);
        const result = await postEpicUpdates({mclient, ...postCommentData});

        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postCommentData, issueID: null};

        try {
            const result = await postEpicUpdates({mclient, ...newBody});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in get issue',
                'Error in request https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-801',
                'requestError: request to https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-801 failed, reason: Nock: No match for request {'
            ].join('\n');
            expect(err).to.include(expected);
        }
    });

    it('Redis error in isInEpic', async () => {
        sismemberAsyncStub.throws('Error in sismemberAsync!!!');

        try {
            const result = await postEpicUpdates({mclient, ...postCommentData});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in postNewIssue',
                'Error while querying redis',
                'Error in sismemberAsync!!!'
            ].join('\n');
            expect(err).to.deep.equal(expected);
        }
    });

    it('Epic key is in redis', async () => {
        sendHtmlMessageStub.reset();
        sismemberAsyncStub.returns('Ok');

        const result = await postEpicUpdates({mclient, ...postCommentData});
        expect(sendHtmlMessageStub).not.to.be.called;
        expect(result).to.be.true;
    });

    it('Redis error in isInEpic', async () => {
        sismemberAsyncStub.reset();
        saddAsyncStub.throws('Error in saddAsyncStub!!!');

        try {
            const result = await postEpicUpdates({mclient, ...postCommentData});
        } catch (err) {
            const expected = [
                'Error in postEpicUpdates',
                'Error in postNewIssue',
                'Redis error while adding issue to epic',
                'Error in saddAsyncStub!!!'
            ].join('\n');
            expect(err).to.deep.equal(expected);
        }
    });

    after(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
