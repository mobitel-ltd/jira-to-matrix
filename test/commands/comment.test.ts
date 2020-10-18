import querystring from 'querystring';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { translate } from '../../src/locales';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { Commands } from '../../src/bot/commands';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { CommandNames, RunCommandsOptions } from '../../src/types';
import { config } from '../../src/config';
import { Gitlab } from '../../src/task-trackers/gitlab';
import projectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import { getRequestErrorLog } from '../../src/lib/messages';
import { KeyType } from '../../src/task-trackers/gitlab/selectors';

const { expect } = chai;
chai.use(sinonChai);

describe('comment test', () => {
    let chatApi;
    let baseOptions: RunCommandsOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Comment;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const senderDisplayName = 'Иванов Иван Иванович';
    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;
        const roomData = getChatClass().getRoomData();

        baseOptions = { roomId, roomName, sender, chatApi, bodyText, roomData, senderDisplayName };
        nock(taskTracker.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(senderDisplayName, bodyText))
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
    const issueId = 123;

    const projectWithNamespace = projectNamespace + '/' + projectKey;
    const roomName = projectWithNamespace + '-' + issueId;

    const commandName = CommandNames.Comment;
    const sender = 'user';
    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment not to be sent and error send to room', async () => {
        baseOptions = { roomId, roomName, sender, chatApi, bodyText: 'lalalla' };
        const result = await commands.run(commandName, baseOptions);
        expect(result).to.be.eq(
            getRequestErrorLog(
                gitlabTracker.getRestUrl('projects', querystring.escape(`${projectWithNamespace}`)),
                undefined,
                'GET',
            ),
        );
    });

    describe('Slash command', () => {
        const bodyText = '/assign @ii_ivanov';
        beforeEach(() => {
            baseOptions = { roomId, roomName, sender, chatApi, bodyText };
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .reply(200, projectsJson)
                .post(`/projects/${projectsJson.id}/issues/${issueId}/notes`)
                .reply(400);
        });

        it('Expect comment to be sent', async () => {
            const result = await commands.run(commandName, baseOptions);
            expect(chatApi.sendHtmlMessage).not.to.be.called;
            expect(result).to.be.undefined;
        });

        it('Expect comment not to be sent and return undefined if command made is not issue room', async () => {
            baseOptions = {
                roomId,
                roomName: gitlabTracker.selectors.transformToKey(projectWithNamespace, issueId, KeyType.Milestone),
                sender,
                chatApi,
                bodyText: 'lalalla',
            };
            const result = await commands.run(commandName, baseOptions);
            expect(result).to.be.undefined;
            expect(chatApi.sendHtmlMessage).not.to.be.called;
        });
    });
});
