const faker = require('faker');
const utils = require('../../src/lib/utils.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const {admins} = require('../../src/config').matrix;
const op = require('../../src/matrix/timeline-handler/commands/op');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const [sender] = admins;

describe('op test', () => {
    const fakeSender = faker.name.firstName();
    const userB = {displayName: 'Ivan Sergeevich B', name: 'is_b'};

    const roomName = 'BBCOM-123';
    const content = 'content';

    const room = {
        roomId: 12345,
        members: [
            {
                userId: utils.getMatrixUserID(userB.name),
            },
            {
                userId: utils.getMatrixUserID(sender),
            },
        ],
        getJoinedMembers: () => room.members,
    };

    const matrixClient = {
        sendHtmlMessage: stub(),
        setPowerLevel: stub(),
        getStateEvent: stub().withArgs(room.roomId, 'm.room.power_levels', '').resolves(content),
    };

    afterEach(() => {
        Object.values(matrixClient).map(val => val.resetHistory());
    });

    it('Expect message about admin rules to be sent if user is not admin', async () => {
        const res = await op({sender: fakeSender, room, roomName, matrixClient});

        const post = translate('notAdmin', {sender: fakeSender});
        expect(res).to.be.eq(post);
        expect(matrixClient.sendHtmlMessage).to.be.calledWithExactly(room.roomId, post, post);
        expect(matrixClient.setPowerLevel).not.to.be.called;
    });

    it('Expect power level of sender to be put ("!op" command)', async () => {
        const res = await op({sender, room, roomName, matrixClient});

        expect(res).to.be.eq(messages.getModeratorAddLog(utils.getMatrixUserID(sender), roomName));
        expect(matrixClient.sendHtmlMessage).not.to.be.called;
        expect(matrixClient.setPowerLevel).to.be.calledWith(room.roomId, utils.getMatrixUserID(sender), 50);
    });

    it('Expect power level of adding user to be put if he is a room member ("!op is_b")', async () => {
        const newBody = userB.name;
        const res = await op({bodyText: newBody, sender, room, roomName, matrixClient});

        expect(res).to.be.eq(messages.getModeratorAddLog(utils.getMatrixUserID(userB.name), roomName));
        expect(matrixClient.sendHtmlMessage).not.to.be.called;
        expect(matrixClient.setPowerLevel).to.be.calledWith(room.roomId, utils.getMatrixUserID(userB.name), 50);
    });

    it('Expect power level of adding user NOT to be put if he is NOT a room member ("!op fake")', async () => {
        const newBody = fakeSender;
        const res = await op({bodyText: newBody, sender, room, roomName, matrixClient});

        const post = translate('notFoundUser', {user: fakeSender});
        expect(res).to.be.eq(post);
        expect(matrixClient.sendHtmlMessage).to.be.calledWithExactly(room.roomId, post, post);
        expect(matrixClient.setPowerLevel).not.to.be.called;
    });
});
