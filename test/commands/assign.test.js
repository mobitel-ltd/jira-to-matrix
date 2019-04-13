const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas.js');
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const commandHandler = require('../../src/bot/timeline-handler');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('assign test', () => {
    let chatApi;
    let baseOptions;
    const commandName = 'assign';

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
    const ivanUsers = [userA, userB];
    const sender = 'my_sender';
    const senderDisplayName = 'My Sender S';

    const userSender = {displayName: senderDisplayName, name: sender};

    const roomName = 'BBCOM-123';

    const roomId = testUtils.getRoomId();

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        baseOptions = {roomId, roomName, commandName, sender, chatApi};
        nock(utils.getRestUrl())
            .put(`/issue/${roomName}/assignee`, schemas.assignee(sender))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userB.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(userA.name))
            .reply(204)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noPermissionUser.name))
            .reply(403)
            .put(`/issue/${roomName}/assignee`, schemas.assignee(noRulesUser.name))
            .reply(404)
            .get('/user/search')
            .query({username: sender})
            .reply(200, [userSender])
            .get('/user/search')
            .query({username: 'Ivan'})
            .reply(200, ivanUsers)
            .get('/user/search')
            .query({username: noPermissionUser.displayName})
            .reply(200, [noPermissionUser])
            .get('/user/search')
            .query({username: noRulesUser.displayName})
            .reply(200, [noRulesUser])
            .get('/user/search')
            .query({username: 'fake'})
            .reply(200, []);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect assign sender ("!assign")', async () => {
        const post = translate('successMatrixAssign', {displayName: senderDisplayName});
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect not assign sender ("!assign fake")', async () => {
        const bodyText = 'fake';
        const post = translate('errorMatrixAssign', {userToFind: bodyText});
        const result = await commandHandler({bodyText, ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect assign list of senders ("!assign Ivan")', async () => {
        const post = utils.getListToHTML(ivanUsers);
        const result = await commandHandler({bodyText: 'Ivan', ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be error (invite throw)', async () => {
        chatApi.invite.throws('Error!!!');
        const post = translate('errorMatrixCommands');

        const result = await commandHandler(baseOptions);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
        expect(result).to.be.undefined;
    });

    it('Expect be sent msg about adding admin status if 403 error got in request', async () => {
        const post = translate('setBotToAdmin');
        const result = await commandHandler({bodyText: noPermissionUser.displayName, ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be sent msg about no access to project if 404 error got in request', async () => {
        const post = translate('noRulesToWatchIssue');
        const result = await commandHandler({bodyText: noRulesUser.displayName, ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
