const {getBotFunc} = require('../src/queue/bot-handler');
const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const {
    postEpicUpdates, 
    postComment,
    createRoom, 
    inviteNewMembers, 
    postNewLinks,
    postLinkedChanges,
    postIssueUpdates,
    postProjectUpdates,
} = require('../src/bot');
const bot = require('../src/bot');
const Matrix = require('../src/matrix/');
const {
    getPostEpicUpdatesData, 
    getPostCommentData, 
    getCreateRoomData, 
    getInviteNewMembersData, 
    getPostNewLinksData,
    getPostLinkedChangesData,
    getPostIssueUpdatesData,
    getPostProjectUpdatesData,
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

    it('postComment', async () => {
        const mclient = await Matrix.connect();
        const postCommentData = getPostCommentData(firstBody);
        const body = {mclient, ...postCommentData};
        const result = await postComment(body);
        logger('result', result);
        assert.ok(result);
        Matrix.disconnect();
    })

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

    // it('postEpicUpdates', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postEpicUpdatesData = getPostEpicUpdatesData(secondBody);
    //     logger('postEpicUpdates', postEpicUpdatesData);
    //     const body = {mclient, ...postEpicUpdatesData};
    //     const result = await postEpicUpdates(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    // it('postLinkedChanges', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postLinkedChangesData = getPostLinkedChangesData(secondBody);
    //     logger('postLinkedChanges', postLinkedChangesData);
    //     const body = {mclient, ...postLinkedChangesData};
    //     const result = await postLinkedChanges(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })
   
    // it('postIssueUpdates', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postIssueUpdatesData = getPostIssueUpdatesData(secondBody);
    //     logger('postIssueUpdates', postIssueUpdatesData);
    //     const body = {mclient, ...postIssueUpdatesData};
    //     const result = await postIssueUpdates(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })

    // it('postProjectUpdates', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     const mclient = await connect();
    //     const postProjectUpdatesData = getPostProjectUpdatesData(secondBody);
    //     logger('postProjectUpdates', postProjectUpdatesData);
    //     const body = {mclient, ...postProjectUpdatesData};
    //     const result = await postProjectUpdates(body);
    //     logger('result', result);
    //     assert.ok(result);
    //     await disconnect();
    // })
});
