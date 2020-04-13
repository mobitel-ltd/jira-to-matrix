const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas.js');
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const commandHandler = require('../../src/bot/commands');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('assign test', () => {
    let chatApi;
    let baseOptions;
    const commandName = 'assign';

    const noPermissionUser = {
        displayName: 'Ignore User',
        accountId: 'noPermissionAccountId',
    };
    const noRulesUser = {
        displayName: 'No Rules User',
        accountId: 'noRulesUserAccountId',
    };

    const userA = { displayName: testUtils.usersWithSamePartName[0], accountId: 'userAaccountId' };
    const userB = { displayName: testUtils.usersWithSamePartName[1], accountId: 'userBaccountId' };

    const partName = testUtils.usersWithSamePartName[0].slice(0, 5);

    const ivanUsers = [userA, userB];
    const existingSenderDisplayName = testUtils.getExistingDisplayName();
    const existingSenderId = testUtils.getUserIdByDisplayName(existingSenderDisplayName);
    const existingUserChatData = { userId: existingSenderId, displayName: existingSenderDisplayName };

    const userSender = { displayName: existingSenderDisplayName, accountId: 'userSenderAccountId' };

    const roomName = 'BBCOM-123';

    const roomId = testUtils.getRoomId();

    beforeEach(() => {
        chatApi = testUtils.getChatApi({ existedUsers: [existingUserChatData] });
        baseOptions = { roomId, roomName, commandName, sender: existingSenderId, chatApi };
        nock(utils.getRestUrl())
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userSender.accountId))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userB.accountId))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userA.accountId))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noPermissionUser.accountId))
            .reply(403)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noRulesUser.accountId))
            .reply(404)
            .get('/user/search')
            .query({ username: existingSenderDisplayName })
            .reply(200, [userSender])
            .get('/user/search')
            .query({ username: partName })
            .reply(200, ivanUsers)
            .get('/user/search')
            .query({ username: noPermissionUser.displayName })
            .reply(200, [noPermissionUser])
            .get('/user/search')
            .query({ username: noRulesUser.displayName })
            .reply(200, [noRulesUser])
            .get('/user/search')
            .query({ username: 'fake' })
            .reply(200, []);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    // TODO need the way how to get diplayname of sender
    it('Expect assign sender ("!assign")', async () => {
        const post = translate('successMatrixAssign', { displayName: existingSenderDisplayName });
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect not assign sender ("!assign fake")', async () => {
        const bodyText = 'fake';
        const post = translate('errorMatrixAssign', { userToFind: bodyText });
        const result = await commandHandler({ bodyText, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect assign list of senders ("!assign Ivan")', async () => {
        const post = utils.getListToHTML(ivanUsers);
        const result = await commandHandler({ bodyText: partName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be error (invite throw)', async () => {
        chatApi.invite.throws('Error!!!');
        const post = translate('errorMatrixCommands');

        const result = await commandHandler({ bodyText: userSender.displayName, ...baseOptions });
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
        expect(result).to.be.undefined;
    });

    it('Expect be sent msg about adding admin status if 403 error got in request', async () => {
        const post = translate('setBotToAdmin');
        const result = await commandHandler({ bodyText: noPermissionUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be sent msg about no access to project if 404 error got in request', async () => {
        const post = translate('noRulesToWatchIssue');
        const result = await commandHandler({ bodyText: noRulesUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
