const {getBotFunc} = require('../src/queue/bot-handler');
const assert = require('assert');
const logger = require('debug')('test-bot-func');
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const {
    postEpicUpdates, 
    postComment,
    createRoom, 
    inviteNewMembers, 
    postNewLinks
} = require('../src/bot');
const bot = require('../src/bot');
const matrixApi = require('../src/matrix/');
const {
    getPostEpicUpdatesData, 
    getPostCommentData, 
    getCreateRoomData, 
    getInviteNewMembersData, 
    getPostNewLinksData
} = require('../src/queue/parse-body.js');

describe('bot func', function() {
    this.timeout(15000);

    it('test correct JSON', () => {
        const result = typeof firstBody;
        logger('result', result);
        assert.equal(result, 'object');
    });

    it('test correct funcs ', () => {
        const result = getBotFunc(firstBody);
        logger('result', result);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('test correct funcs seconBody', () => {
        const result = getBotFunc(secondBody);
        logger('result', result);
        const expected = [
            'createRoom',
            'inviteNewMembers', 
            'postEpicUpdates', 
            'postNewLinks', 
        ];
        assert.deepEqual(result, expected);
    });

    it('async arr expect', () => {
        const funcsForBot = getBotFunc(firstBody);
        logger('funcsForBot', Array.isArray(funcsForBot));
        const result = funcsForBot.map(func => bot[func]);
        assert.ok(Array.isArray(result));
    });

    // it('postComment', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postCommentData = getPostCommentData(firstBody);
    //     const body = {mclient, ...postCommentData};
    //     const result = await postComment(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    // it('createRoom', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const createRoomData = getCreateRoomData(secondBody);
    //     logger('createRoomData', createRoomData);
    //     const body = {mclient, ...createRoomData};
    //     const result = await createRoom(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    // it('inviteNewMembers', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const inviteNewMembersData = getInviteNewMembersData(secondBody);
    //     logger('inviteNewMembersData', inviteNewMembersData);
    //     const body = {mclient, ...inviteNewMembersData};
    //     const result = await inviteNewMembers(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    // it('postNewLinks', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postNewLinksData = getPostNewLinksData(secondBody);
    //     logger('inviteNewMembersData', postNewLinksData);
    //     const body = {mclient, ...postNewLinksData};
    //     const result = await postNewLinks(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    it('postEpicUpdates', async () => {
        const {connect, disconnect, helpers} = matrixApi;
        const mclient = await connect();
        const postEpicUpdatesData = getPostEpicUpdatesData(secondBody);
        logger('postEpicUpdates', postEpicUpdatesData);
        const body = {mclient, ...postEpicUpdatesData};
        const result = await postEpicUpdates(body);
        logger('result', result);
        assert.ok(result);
        await disconnect();
    })
});
