import nock from 'nock';
import * as utils from '../../src/lib/utils';
import { translate } from '../../src/locales';
import { Commands } from '../../src/bot/commands';
import { getChatClass, taskTracker, usersWithSamePartName, getRoomId } from '../test-utils';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { CommandNames } from '../../src/types';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('spec test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Spec;
    const noRulesUser = {
        displayName: 'No Rules User',
        accountId: 'noRulesUserAccountId',
    };

    const noPermissionUser = {
        displayName: 'Ignore User',
        accountId: 'noPermissionAccountId',
    };

    const userA = { displayName: usersWithSamePartName[0], accountId: 'userAaccountId' };
    const userB = { displayName: usersWithSamePartName[1], accountId: 'userBaccountId' };
    const partName = usersWithSamePartName[0].slice(0, 5);

    const users = [userA, userB];

    const roomName = 'BBCOM-123';
    const roomId = getRoomId();

    beforeEach(() => {
        nock(taskTracker.getRestUrl())
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
        chatApi = getChatClass().chatApiSingle;
        baseOptions = { roomId, roomName, chatApi };
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should add user ("!spec Ivan Andreevich A")', async () => {
        const post = translate('successWatcherJira');
        const result = await commands.run(commandName, { bodyText: userA.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should not add to watchers("!spec fake")', async () => {
        const result = await commands.run(commandName, { bodyText: 'fake', ...baseOptions });
        const post = translate('errorWatcherJira');

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should show list of users ("!spec Ivan")', async () => {
        const post = utils.getListToHTML(users);
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: partName,
        });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should be error (invite throw)', async () => {
        const errorMessage = 'Error!!!';
        chatApi.invite.throws('Error!!!');
        let result;
        try {
            result = await commands.run(commandName, { bodyText: userA.displayName, ...baseOptions });
        } catch (err) {
            result = err;
        }
        const message = utils.errorTracing('Spec command', errorMessage);

        expect(result).to.be.undefined;
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, message, message);
    });

    it('should be sent msg about adding admin status if 403 error got in request', async () => {
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const viewUrl = taskTracker.getViewUrl(projectKey);
        const post = translate('setBotToAdmin', { projectKey, viewUrl });
        const result = await commands.run(commandName, { bodyText: noPermissionUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('should be sent msg about no access to project if 404 error got in request', async () => {
        const post = translate('noRulesToWatchIssue');
        const result = await commands.run(commandName, { bodyText: noRulesUser.displayName, ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
