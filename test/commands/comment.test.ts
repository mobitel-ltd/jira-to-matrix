import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { translate } from '../../src/locales';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { Commands } from '../../src/bot/commands';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { CommandNames } from '../../src/types';
import { config } from '../../src/config';
import { Gitlab } from '../../src/task-trackers/gitlab';
import projectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';

const { expect } = chai;
chai.use(sinonChai);

describe('comment test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Comment;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;

        baseOptions = { roomId, roomName, sender, chatApi, bodyText };
        nock(taskTracker.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        const result = await commands.run(commandName, baseOptions);
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.undefined;
    });

    it('Expect comment not to be sent with empty body and warn message will be sent', async () => {
        const post = translate('emptyBodyText');
        const result = await commands.run(commandName, { ...baseOptions, bodyText: '' });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });
});

describe('gitlab comment test', () => {
    let chatApi;
    let baseOptions;
    const gitlabTracker = new Gitlab({
        url: 'https://gitlab.test-example.ru',
        user: 'gitlab_bot',
        password: 'fakepasswprd',
        features: config.features,
    });
    const commands = new Commands(config, gitlabTracker);
    const projectNamespace = 'indev';
    const projectKey = 'gitlabtomatrix';
    const issueId = '123';

    const roomName = projectNamespace + '/' + projectKey + '-' + issueId;

    const commandName = CommandNames.Comment;
    const sender = 'user';
    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Slash command', () => {
        const bodyText = '/assign @ii_ivanov';
        beforeEach(() => {
            baseOptions = { roomId, roomName, sender, chatApi, bodyText };
            nock(gitlabTracker.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .reply(200, projectsJson)
                .post(`/projects/${projectsJson[0].id}/issues/${issueId}/notes`)
                .query({ body: bodyText })
                .reply(400);
        });
        it('Expect comment to be sent', async () => {
            const result = await commands.run(commandName, baseOptions);
            expect(chatApi.sendHtmlMessage).not.to.be.called;
            expect(result).to.be.undefined;
        });
    });
});
