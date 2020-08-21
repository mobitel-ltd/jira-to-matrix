import nock from 'nock';
import * as utils from '../../src/lib/utils';
import { translate } from '../../src/locales';
import {
    getChatClass,
    taskTracker,
    usersWithSamePartName,
    getExistingDisplayName,
    getUserIdByDisplayName,
} from '../test-utils';
import { Commands } from '../../src/bot/commands';
import sinonChai from 'sinon-chai';
import { schemas } from '../../src/task-trackers/jira/schemas';
import * as chai from 'chai';
import { config } from '../../src/config';
import { CommandNames } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('assign test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Assign;

    const noPermissionUser = {
        displayName: 'Ignore User',
        accountId: 'noPermissionAccountId',
    };
    const noRulesUser = {
        displayName: 'No Rules User',
        accountId: 'noRulesUserAccountId',
    };

    const userA = { displayName: usersWithSamePartName[0], accountId: 'userAaccountId' };
    const userB = { displayName: usersWithSamePartName[1], accountId: 'userBaccountId' };

    const partName = usersWithSamePartName[0].slice(0, 5);

    const ivanUsers = [userA, userB];
    const existingSenderDisplayName = getExistingDisplayName();
    const existingSenderId = getUserIdByDisplayName(existingSenderDisplayName);
    const existingUserChatData = { userId: existingSenderId, displayName: existingSenderDisplayName };

    const userSender = { displayName: existingSenderDisplayName, accountId: 'userSenderAccountId' };

    const roomId = 'roomId';
    const roomName = 'BBCOM-123';

    beforeEach(() => {
        const chatClass = getChatClass({ existedUsers: [existingUserChatData] });
        chatApi = chatClass.chatApiSingle;
        const roomData = chatClass.getRoomData({ alias: roomName, roomId });

        baseOptions = { sender: existingSenderId, chatApi, roomData, roomId, roomName };
        nock(taskTracker.getRestUrl())
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
            .query({ query: existingSenderDisplayName })
            .reply(200, [userSender])
            .get('/user/search')
            .query({ query: partName })
            .reply(200, ivanUsers)
            .get('/user/search')
            .query({ query: noPermissionUser.displayName })
            .reply(200, [noPermissionUser])
            .get('/user/search')
            .query({ query: noRulesUser.displayName })
            .reply(200, [noRulesUser])
            .get('/user/search')
            .query({ query: 'fake' })
            .reply(200, []);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    // TODO need the way how to get diplayname of sender
    it('Expect assign sender ("!assign")', async () => {
        const post = translate('successMatrixAssign', { displayName: existingSenderDisplayName });
        const result = await commands.run(commandName, baseOptions);

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect not assign sender ("!assign fake")', async () => {
        const bodyText = 'fake';
        const post = translate('errorMatrixAssign', { userToFind: bodyText });
        const result = await commands.run(commandName, { bodyText, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect assign list of senders ("!assign Ivan")', async () => {
        const post = utils.getListToHTML(ivanUsers);
        const result = await commands.run(commandName, { bodyText: partName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be error (invite throw)', async () => {
        const errorMessage = 'Error!!!';
        chatApi.invite.throws(errorMessage);

        const result = await commands.run(commandName, { bodyText: userSender.displayName, ...baseOptions });
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, errorMessage, errorMessage);
        expect(result).to.be.undefined;
    });

    it('Expect be sent msg about adding admin status if 403 error got in request', async () => {
        const post = translate('setBotToAdmin');
        const result = await commands.run(commandName, { bodyText: noPermissionUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect be sent msg about no access to project if 404 error got in request', async () => {
        const post = translate('noRulesToWatchIssue');
        const result = await commands.run(commandName, { bodyText: noRulesUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
