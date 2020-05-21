import nock from 'nock';
import * as utils from '../../src/lib/utils';
const schemas from '../../src/lib/schemas');
import { translate } from '../../src/locales';
const commandHandler from '../../src/bot/commands');
const testUtils from '../test-utils');

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('spec test', () => {
    let chatApi;
    let baseOptions;
    const noRulesUser = {
        displayName: 'No Rules User',
        accountId: 'noRulesUserAccountId',
    };

    const noPermissionUser = {
        displayName: 'Ignore User',
        accountId: 'noPermissionAccountId',
    };

    const userA = { displayName: testUtils.usersWithSamePartName[0], accountId: 'userAaccountId' };
    const userB = { displayName: testUtils.usersWithSamePartName[1], accountId: 'userBaccountId' };
    const partName = testUtils.usersWithSamePartName[0].slice(0, 5);

    const users = [userA, userB];

    const roomName = 'BBCOM-123';
    const roomId = 12345;
    const commandName = 'spec';

    before(() => {
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/watchers`, schemas.watcher(userB.accountId))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(userA.accountId))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(noPermissionUser.accountId))
            .reply(403)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(noRulesUser.accountId))
            .reply(404)
            .get('/user/search')
            .query({ query: partName })
            .reply(200, users)
            .get('/user/search')
            .query({ query: userA.displayName })
            .reply(200, [userA])
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

    beforeEach(() => {
        chatApi = testUtils.getChatClass();
        baseOptions = { roomId, roomName, commandName, chatApi };
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('should add user ("!spec Ivan Andreevich A")', async () => {
        const post = translate('successWatcherJira');
        const result = await commandHandler({ bodyText: userA.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should not add to watchers("!spec fake")', async () => {
        const result = await commandHandler({ bodyText: 'fake', ...baseOptions });
        const post = translate('errorWatcherJira');

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should show list of users ("!spec Ivan")', async () => {
        const post = utils.getListToHTML(users);
        const result = await commandHandler({
            ...baseOptions,
            bodyText: partName,
        });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should be error (invite throw)', async () => {
        const post = translate('errorMatrixCommands');
        chatSingle.invite.throws('Error!!!');
        let result;
        try {
            result = await commandHandler({ bodyText: userA.displayName, ...baseOptions });
        } catch (err) {
            result = err;
        }

        expect(result).to.be.undefined;
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should be sent msg about adding admin status if 403 error got in request', async () => {
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const viewUrl = utils.getViewUrl(projectKey);
        const post = translate('setBotToAdmin', { projectKey, viewUrl });
        const result = await commandHandler({ bodyText: noPermissionUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should be sent msg about no access to project if 404 error got in request', async () => {
        const post = translate('noRulesToWatchIssue');
        const result = await commandHandler({ bodyText: noRulesUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
