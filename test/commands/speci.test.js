const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const commandHandler = require('../../src/bot/timeline-handler');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('spec test', () => {
    const noRulesUser = {
        displayName: 'No Rules User',
        name: 'noRules',
    };

    const noPermissionUser = {
        displayName: 'Ignore User',
        name: 'ignore',
    };

    const userA = {displayName: 'Ivan Andreevich A', name: 'ia_a'};
    const userB = {displayName: 'Ivan Sergeevich B', name: 'is_b'};

    const users = [userA, userB];

    const chatApi = {
        sendHtmlMessage: stub(),
        invite: stub(),
    };

    const roomName = 'BBCOM-123';
    const roomId = 12345;
    const commandName = 'spec';

    const baseOptions = {roomId, roomName, commandName, chatApi};

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .post(`/issue/${roomName}/watchers`, schemas.watcher(userB.name))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(userA.name))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(noPermissionUser.name))
            .reply(403)
            .post(`/issue/${roomName}/watchers`, schemas.watcher(noRulesUser.name))
            .reply(404)
            .get('/user/search')
            .query({username: 'Ivan'})
            .reply(200, users)
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
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('should add user ("!spec Ivan Andreevich A")', async () => {
        // searchUserStub.resolves([userA]);
        const post = translate('successWatcherJira');
        const result = await commandHandler({bodyText: userA.displayName, ...baseOptions});
        expect(result).to.be.eq(post);

        // expect(result).to.be.equal(messages.getWatcherAddedLog(userA.displayName, roomName));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('should not add to watchers("!spec fake")', async () => {
        // searchUserStub.resolves([]);
        const result = await commandHandler({bodyText: 'fake', ...baseOptions});
        const post = translate('errorWatcherJira');

        expect(result).to.be.eq(post);
        // expect(result).to.be.equal(messages.getWatcherNotAddedLog(userA.displayName));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('should show list of users ("!spec Ivan")', async () => {
        // searchUserStub.resolves(users);
        const post = utils.getListToHTML(users);
        const result = await commandHandler({bodyText: 'Ivan', ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('should be in room', async () => {
        // searchUserStub.resolves([userB]);
        chatApi.invite.throws('Error!!!');
        const post = translate('successWatcherJira');
        const result = await commandHandler({bodyText: userB.displayName, ...baseOptions});

        expect(result).to.be.equal(messages.getWatcherAddedLog(userB.displayName, roomName));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
        expect(chatApi.invite).not.to.be.called;
    });

    it('should be error (invite throw)', async () => {
        // searchUserStub.resolves(users.slice(0, 1));
        chatApi.invite.throws('Error!!!');
        const expected = [
            utils.getDefaultErrorLog('Spec command'),
            utils.getDefaultErrorLog('addToWatchers'),
            'Error!!!',
        ].join('\n');
        let result;
        try {
            result = await commandHandler({bodyText: userA.displayName, ...baseOptions});
        } catch (err) {
            result = err;
        }

        expect(result).to.be.equal(expected);
        const post = translate('errorMatrixCommands');
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('should be sent msg about adding admin status if 403 error got in request', async () => {
        // searchUserStub.resolves([noPermissionUser]);
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const viewUrl = utils.getViewUrl(projectKey);
        const post = translate('setBotToAdmin', {projectKey, viewUrl});
        const result = await commandHandler({bodyText: noPermissionUser.displayName, ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('should be sent msg about no access to project if 404 error got in request', async () => {
        // searchUserStub.resolves([noRulesUser]);
        const post = translate('noRulesToWatchIssue');
        const result = await commandHandler({bodyText: noRulesUser.displayName, ...baseOptions});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });
});
