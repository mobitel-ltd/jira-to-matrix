const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const {schemaAssignee} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const proxyquire = require('proxyquire');
const searchUserStub = stub();

const assign = proxyquire('../../src/matrix/timeline-handler/commands/assign.js', {
    './helper.js': {
        searchUser: searchUserStub,
    },
});

describe('assign test', () => {
    const noPermissionUser = {
        displayName: 'Ignore User',
        name: 'ignore',
    };
    const noRulesUser = {
        displayName: 'No Rules User',
        name: 'noRules',
    };

    const userA = {displayName: 'Ivan Andreevich A', name: 'ia_a'};
    const userB = {displayName: 'Ivan Sergeevich B', name: 'is_b'};
    const senderName = 'my_sender';
    const senderDisplayName = 'My Sender S';

    const userSender = {displayName: senderDisplayName, name: senderName};
    const users = [userA, userB, userSender];

    const matrixClient = {
        sendHtmlMessage: stub(),
        invite: stub(),
    };

    const roomName = 'BBCOM-123';
    const body = '!assign';

    const sender = utils.getMatrixUserID(senderName);
    const room = {
        roomId: 12345,
        members: [
            {
                userId: utils.getMatrixUserID(userB.name),
            },
        ],
        getJoinedMembers: () => room.members,
    };

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {Authorization: utils.auth()},
        })
            .put(`/issue/${roomName}/assignee`, schemaAssignee(senderName))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemaAssignee(userB.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemaAssignee(userA.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemaAssignee(noPermissionUser.name))
            .reply(403)
            .put(`/issue/${roomName}/assignee`, schemaAssignee(noRulesUser.name))
            .reply(404);
    });

    afterEach(() => {
        Object.values(matrixClient).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('should assign sender ("!assign")', async () => {
        searchUserStub.returns(users.slice(2, 3));
        const post = translate('successMatrixAssign', {displayName: senderDisplayName});
        const result = await assign({body, sender, room, roomName, matrixClient});

        expect(result).to.be.equal(messages.getAssigneeAddedLog(senderDisplayName, roomName));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('should not assign sender ("!assign fake")', async () => {
        searchUserStub.returns([]);
        const post = translate('errorMatrixAssign', {userToFind: userA.displayName});
        const result = await assign({body: `!assign ${userA.displayName}`, sender, room, roomName, matrixClient});

        expect(result).to.be.equal(messages.getAssigneeNotAddedLog(userA.displayName, roomName));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('should assign list of senders ("!assign Ivan")', async () => {
        searchUserStub.returns(users.slice(0, 2));
        const post = 'List users:<br><strong>ia_a</strong> - Ivan Andreevich A<br><strong>is_b</strong> - Ivan Sergeevich B<br>';
        const result = await assign({body: '!assign Ivan', sender, room, roomName, matrixClient});

        expect(result).to.be.undefined;
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, 'List users', post);
    });

    it('should be in room', async () => {
        const newUsers = users.slice(1, 2);
        searchUserStub.returns(newUsers);
        matrixClient.invite.throws('Error!!!');
        const [{displayName}] = newUsers;
        const post = translate('successMatrixAssign', {displayName});
        const expected = `The user ${displayName} is assigned to issue ${roomName}`;
        const result = await assign({body: '!assign Ivan Sergeevich B', sender, room, roomName, matrixClient});

        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
        expect(result).to.be.equal(expected);
    });

    it('should be error (invite throw)', async () => {
        searchUserStub.returns(users.slice(0, 1));
        matrixClient.invite.throws('Error!!!');
        const expected = [
            utils.getDefaultErrorLog('Assign command'),
            utils.getDefaultErrorLog('addToAssignee'),
            'Error!!!',
        ].join('\n');
        let result;
        try {
            result = await assign({body: '!assign Ivan Andreevich A', sender, room, roomName, matrixClient});
            expect(matrixClient.sendHtmlMessage).not.to.have.been.called;
            expect(result).not.to.be;
        } catch (err) {
            result = err;
        }
        expect(result).to.be.equal(expected);
    });

    it('should be sent msg about adding admin status if 403 error got in request', async () => {
        searchUserStub.resolves([noPermissionUser]);
        const post = translate('setBotToAdmin');
        const noPermissionUserBody = `!assign ${noPermissionUser.displayName}`;
        const result = await assign({body: noPermissionUserBody, sender, room, roomName, matrixClient});

        expect(result).to.be.eq(post);
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('should be sent msg about no access to project if 404 error got in request', async () => {
        searchUserStub.resolves([noRulesUser]);
        const post = translate('noRulesToWatchIssue');
        const noRulesUserBody = `!assign ${noRulesUser.displayName}`;
        const result = await assign({body: noRulesUserBody, sender, room, roomName, matrixClient});

        expect(result).to.be.eq(post);
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });
});
