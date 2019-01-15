const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const {schemaWatcher} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const proxyquire = require('proxyquire');
const searchUserStub = stub();

const spec = proxyquire('../../src/matrix/timeline-handler/commands/speci.js', {
    './helper.js': {
        searchUser: searchUserStub,
    },
});

describe('spec test', () => {
    const noPermissionUser = {
        displayName: 'Ignore User',
        name: 'ignore',
    };

    const userA = {displayName: 'Ivan Andreevich A', name: 'ia_a'};
    const userB = {displayName: 'Ivan Sergeevich B', name: 'is_b'};

    const users = [userA, userB];

    const matrixClient = {
        sendHtmlMessage: stub(),
        invite: stub(),
    };

    const roomName = 'BBCOM-123';
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
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .post(`/issue/${roomName}/watchers`, schemaWatcher(userB.name))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemaWatcher(userA.name))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemaWatcher(noPermissionUser.name))
            .reply(403)
            .post(`/issue/${roomName}/assignee`)
            .delayBody(2000)
            .reply(404, 'Error!!!');
    });

    afterEach(() => {
        Object.values(matrixClient).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('should add user ("!spec Ivan Andreevich A")', async () => {
        searchUserStub.resolves([userA]);
        const post = translate('successWatcherJira');
        const result = await spec({bodyText: 'Ivan Andreevich A', room, roomName, matrixClient});

        expect(result).to.be.equal(messages.getWatcherAddedLog(userA.displayName, roomName));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('should not add to watchers("!spec fake")', async () => {
        searchUserStub.resolves([]);
        const bodyText = 'fake';
        const result = await spec({bodyText, room, roomName, matrixClient});
        const post = translate('errorWatcherJira');

        expect(result).to.be.equal(messages.getWatcherNotAddedLog(bodyText));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('should show list of users ("!spec Ivan")', async () => {
        searchUserStub.resolves(users.slice(0, 2));
        const post = utils.getListToHTML(users);
        const result = await spec({bodyText: 'Ivan', room, roomName, matrixClient});

        expect(result).to.be.undefined;
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, 'List users', post);
    });

    it('should be in room', async () => {
        searchUserStub.resolves([userB]);
        matrixClient.invite.throws('Error!!!');
        const post = translate('successWatcherJira');
        const result = await spec({bodyText: 'Ivan Sergeevich B', room, roomName, matrixClient});

        expect(result).to.be.equal(messages.getWatcherAddedLog(userB.displayName, roomName));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
        expect(matrixClient.invite).not.to.be.called;
    });

    it('should be error (invite throw)', async () => {
        searchUserStub.resolves(users.slice(0, 1));
        matrixClient.invite.throws('Error!!!');
        const expected = [
            'Matrix spec command error',
            'addAssigneeInWatchers error',
            'Error!!!',
        ].join('\n');
        let result;
        try {
            result = await spec({bodyText: 'Ivan Andreevich A', room, roomName, matrixClient});
        } catch (err) {
            result = err;
        }

        expect(result).to.be.equal(expected);
        expect(matrixClient.sendHtmlMessage).not.to.have.been.called;
    });

    it('should be sent msg about adding admin status if 403 error got in request', async () => {
        searchUserStub.resolves([noPermissionUser]);
        const post = translate('setBotToAdmin');
        const result = await spec({bodyText: noPermissionUser.displayName, room, roomName, matrixClient});

        expect(result).to.be.true;
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });
});
