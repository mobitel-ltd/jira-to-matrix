const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const proxyquire = require('proxyquire');
const searchUserStub = stub();

const assign = proxyquire('../../src/bot/timeline-handler/commands/assign.js', {
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
    const sender = 'my_sender';
    const senderDisplayName = 'My Sender S';

    const userSender = {displayName: senderDisplayName, name: sender};
    const users = [userA, userB, userSender];

    const chatApi = {
        sendHtmlMessage: stub(),
        invite: stub(),
    };

    const roomName = 'BBCOM-123';

    const room = {
        roomId: 12345,
        members: [
            {
                userId: utils.getChatUserId(userB.name),
            },
        ],
        getJoinedMembers: () => room.members,
    };

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {Authorization: utils.auth()},
        })
            .put(`/issue/${roomName}/assignee`, schemas.assignee(sender))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userB.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userA.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noPermissionUser.name))
            .reply(403)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noRulesUser.name))
            .reply(404);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect assign sender ("!assign")', async () => {
        searchUserStub.returns(users.slice(2, 3));
        const post = translate('successMatrixAssign', {displayName: senderDisplayName});
        const result = await assign({sender, room, roomName, chatApi});

        expect(result).to.be.equal(messages.getAssigneeAddedLog(senderDisplayName, roomName));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect not assign sender ("!assign fake")', async () => {
        searchUserStub.returns([]);
        const post = translate('errorMatrixAssign', {userToFind: userA.displayName});
        const result = await assign({bodyText: userA.displayName, sender, room, roomName, chatApi});

        expect(result).to.be.equal(messages.getAssigneeNotAddedLog(userA.displayName, roomName));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect assign list of senders ("!assign Ivan")', async () => {
        const addedUsers = users.slice(0, 2);
        searchUserStub.resolves(addedUsers);
        const post = utils.getListToHTML(addedUsers);
        const result = await assign({body: '!assign Ivan', sender, room, roomName, chatApi});

        expect(result).to.be.undefined;
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, 'List users', post);
    });

    it('Expect be in room', async () => {
        const newUsers = users.slice(1, 2);
        searchUserStub.returns(newUsers);
        chatApi.invite.throws('Error!!!');
        const [{displayName}] = newUsers;
        const post = translate('successMatrixAssign', {displayName});
        const expected = `The user ${displayName} is assigned to issue ${roomName}`;
        const result = await assign({body: '!assign Ivan Sergeevich B', sender, room, roomName, chatApi});

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
        expect(result).to.be.equal(expected);
    });

    it('Expect be error (invite throw)', async () => {
        searchUserStub.returns(users.slice(0, 1));
        chatApi.invite.throws('Error!!!');
        const expected = [
            utils.getDefaultErrorLog('Assign command'),
            utils.getDefaultErrorLog('addToAssignee'),
            'Error!!!',
        ].join('\n');
        let result;
        try {
            result = await assign({body: '!assign Ivan Andreevich A', sender, room, roomName, chatApi});
            expect(chatApi.sendHtmlMessage).not.to.have.been.called;
            expect(result).not.to.be;
        } catch (err) {
            result = err;
        }
        expect(result).to.be.equal(expected);
    });

    it('Expect be sent msg about adding admin status if 403 error got in request', async () => {
        searchUserStub.resolves([noPermissionUser]);
        const post = translate('setBotToAdmin');
        const noPermissionUserBody = `!assign ${noPermissionUser.displayName}`;
        const result = await assign({body: noPermissionUserBody, sender, room, roomName, chatApi});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect be sent msg about no access to project if 404 error got in request', async () => {
        searchUserStub.resolves([noRulesUser]);
        const post = translate('noRulesToWatchIssue');
        const noRulesUserBody = `!assign ${noRulesUser.displayName}`;
        const result = await assign({body: noRulesUserBody, sender, room, roomName, chatApi});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });
});
