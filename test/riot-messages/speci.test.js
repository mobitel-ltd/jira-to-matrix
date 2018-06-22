const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaWatcher} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {domain} = require('../../src/config').matrix;
const translate = require('../../src/locales');

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
    const users = [
        {
            displayName: 'Ivan Andreevich A',
            name: 'ia_a',
        },
        {
            displayName: 'Ivan Sergeevich B',
            name: 'is_b',
        },
    ];

    const sendHtmlMessageStub = stub();
    const inviteStub = stub();
    const matrixClient = {
        invite: inviteStub,
        sendHtmlMessage: sendHtmlMessageStub,
    };

    const roomName = 'BBCOM-123';
    const body = '!spec';
    const room = {
        roomId: 12345,
        members: [
            {
                userId: `@is_b:${domain}`,
            },
        ],
        getJoinedMembers: () => room.members,
    };

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .post(`/${roomName}/watchers`, schemaWatcher('is_b'))
            .times(2)
            .reply(204)
            .post(`/${roomName}/watchers`, schemaWatcher('ia_a'))
            .times(2)
            .reply(204)
            .post(`/${roomName}/assignee`)
            .reply(404, 'Error!!!');
    });

    it('should add user ("!spec Ivan Andreevich A")', async () => {
        const [user] = users;
        searchUserStub.returns([user]);
        const post = translate('successWatcherJira');
        const expected = `User ${user.displayName} was added in watchers for issue ${roomName}`;
        const result = await spec({body, room, roomName, matrixClient});

        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);

        sendHtmlMessageStub.reset();
    });

    it('should not to watchers("!spec fake")', async () => {
        searchUserStub.returns([]);
        const fakeUser = 'fake';
        const post = translate('errorWatcherJira');
        const expected = `Watcher "${fakeUser}" isn't added to ${roomName} issue`;
        const result = await spec({bodyText: fakeUser, room, roomName, matrixClient});

        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);

        sendHtmlMessageStub.reset();
    });

    it('should show list of users ("!spec Ivan")', async () => {
        searchUserStub.returns(users.slice(0, 2));
        const post = 'List users:<br><strong>ia_a</strong> - Ivan Andreevich A<br><strong>is_b</strong> - Ivan Sergeevich B<br>';
        const result = await spec({bodyText: 'Ivan', room, roomName, matrixClient});

        expect(result).to.be.undefined;
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, 'List users', post);

        sendHtmlMessageStub.reset();
        inviteStub.reset();
    });

    it('should be in room', async () => {
        const [newUser] = users.slice(1, 2);
        searchUserStub.returns([newUser]);
        inviteStub.throws('Error!!!');
        const post = translate('successWatcherJira');
        const expected = `User ${newUser.displayName} was added in watchers for issue ${roomName}`;
        const result = await spec({bodyText: 'Ivan Sergeevich B', room, roomName, matrixClient});

        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);
        expect(inviteStub).not.to.be.called;
        expect(result).to.be.equal(expected);

        sendHtmlMessageStub.reset();
        inviteStub.reset();
    });

    it('should be error (invite throw)', async () => {
        searchUserStub.returns(users.slice(0, 1));
        inviteStub.throws('Error!!!');
        try {
            const result = await spec({bodyText: 'Ivan Andreevich A', room, roomName, matrixClient});
            expect(sendHtmlMessageStub).not.to.have.been.called;
            expect(result).not.to.be;
        } catch (err) {
            const expected = [
                'Matrix spec command error',
                'addAssigneeInWatchers error',
                'Error!!!',
            ].join('\n');
            expect(err).to.be.equal(expected);
        }
    });
});
