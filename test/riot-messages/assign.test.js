const nock = require('nock');
const {auth} = require('../../src/jira/common');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaAssignee, schemaWatcher} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {domain} = require('../../src/config').matrix;

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
    const users = [
        {
            displayName: 'Ivan Andreevich A',
            name: 'ia_a',
        },
        {
            displayName: 'Ivan Sergeevich B',
            name: 'is_b',
        },
        // {
        //     displayName: 'Anton Matveevich C',
        //     name: 'am_c',
        // },
        // {
        //     displayName: 'Petr Andreevich D',
        //     name: 'pa_d',
        // },
    ];

    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});
    const inviteStub = stub().callsFake((roomId, user) => {});
    const matrixClient = {
        invite: inviteStub,
        sendHtmlMessage: sendHtmlMessageStub,
    };
    const roomName = 'BBCOM-123';
    const body = '!assign';
    const senderName = 'my_sender'
    const sender = `@${senderName}:${domain}`;
    const room = {
        roomId: 12345,
        members: [
            {
                userId: `@ia_a:${domain}`,
            },
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
            .put(`/${roomName}/assignee`, schemaAssignee(senderName))
            .reply(204)
            .put(`/${roomName}/assignee`, schemaAssignee('is_b'))
            .times(2)
            .reply(204)
            .post(`/${roomName}/watchers`, schemaWatcher(senderName))
            .reply(204)
            .post(`/${roomName}/watchers`, schemaWatcher('is_b'))
            .times(2)
            .reply(204)
            .post(`/${roomName}/assignee`)
            .reply(404, 'Error!!!');
    });


    it('should assign sender ("!assign")', async () => {
        searchUserStub.returns([{name: senderName}]);
        const post = `Пользователь ${senderName} назначен исполнителем задачи`;
        const expected = `The user ${senderName} now assignee issue ${roomName}`;
        const result = await assign({body, sender, room, roomName, matrixClient});

        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);

        sendHtmlMessageStub.reset();
    });

    it('should not assign sender ("!assign fake")', async () => {
        searchUserStub.returns([]);
        const post = 'ОШИБКА! Пользователь "fake" не существует';
        const expected = `User fake or issue ${roomName} is not exist`;
        const result = await assign({body: '!assign fake', sender, room, roomName, matrixClient});

        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);

        sendHtmlMessageStub.reset();
    });

    it('should assign list of senders ("!assign Ivan")', async () => {
        searchUserStub.returns(users);
        const post = 'List users:<br><strong>ia_a</strong> - Ivan Andreevich A<br><strong>is_b</strong> - Ivan Sergeevich B<br>';
        const expected = undefined;
        const result = await assign({body: '!assign fake', sender, room, roomName, matrixClient});

        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, 'List users', post);

        sendHtmlMessageStub.reset();
        inviteStub.reset();
    });

    it('should be in room', async () => {
        searchUserStub.returns(users.slice(1));
        inviteStub.throws('Error!!!');
        const post = `Пользователь is_b назначен исполнителем задачи`;
        const expected = `The user is_b now assignee issue ${roomName}`;
        const result = await assign({body: '!assign Ivan', sender, room, roomName, matrixClient});

        expect(sendHtmlMessageStub).to.have.been.calledWithExactly(room.roomId, post, post);
        expect(result).to.be.equal(expected);

        sendHtmlMessageStub.reset();
        inviteStub.reset();
    });

    it('should be error (invite throw)', async () => {
        searchUserStub.returns(users.slice(1));
        inviteStub.throws('Error!!!');
        try {
            const result = await assign({body: '!assign Ivan', sender, room, roomName, matrixClient});
            expect(sendHtmlMessageStub).not.to.have.been.called;
            expect(result).not.to.be;
        } catch (err) {
            const expected = [
                'Matrix assign command error',
                'addAssigneeInWatchers error',
                'Error!!!'
            ].join('\n');
            expect(err).to.be.equal(expected);
        }
    });

});
