import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import marked from 'marked';
import { translate } from '../../src/locales';
import { getChatClass, taskTracker, cleanRedis, getRoomId } from '../test-utils';
import jiraProject from '../fixtures/jira-api-requests/project-gens/classic/correct.json';
import postNewLinksbody from '../fixtures/webhooks/issuelink/created_relates.json';
import issueLinkBody from '../fixtures/jira-api-requests/issuelinkRelates.json';
import issueBody from '../fixtures/jira-api-requests/issue.json';
import { config } from '../../src/config';
import { Commands } from '../../src/bot/commands';
import * as utils from '../../src/lib/utils';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { CommandNames } from '../../src/types';
import { PostNewLinks } from '../../src/bot/actions/post-new-links';

const { expect } = chai;
chai.use(sinonChai);

describe('create test', () => {
    let chatApi;
    let chatFasade;
    let baseOptions;
    let commands: Commands;

    const commandName = CommandNames.Create;
    const roomName = `${jiraProject.key}-123`;
    const projectKey = jiraProject.key;
    const projectId = jiraProject.id;
    const sender = jiraProject.lead.displayName;
    const issueLinkId = postNewLinksbody.issueLink.id;
    const roomId = getRoomId();
    const bodyText = '';
    const { issueTypes } = jiraProject;
    const projectIssueTypes = issueTypes.map(item => item.name);

    beforeEach(() => {
        commands = new Commands(config, taskTracker);

        chatApi = getChatClass().chatApiSingle;
        chatFasade = getChatClass().chatApi;
        chatApi.getRoomId.withArgs(taskTracker.selectors.getInwardLinkKey(issueLinkBody)).resolves(roomId);
        chatApi.getRoomId.withArgs(taskTracker.selectors.getOutwardLinkKey(issueLinkBody)).resolves(roomId);
        baseOptions = { roomId, roomName, sender, chatApi, bodyText };
        nock(taskTracker.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProject)
            .post(`/issue`, schemas.issueNotChild('abracadabra', '10002', projectId))
            .times(3)
            .reply(201, { key: 'BBCOM-123' })
            .post(`/issueLink`, schemas.issueLink('BBCOM-123', 'BBCOM-123'))
            .reply(201)
            .get(`/issueLink/${issueLinkId}`)
            .reply(200, issueLinkBody)
            .get(`/issue/${issueLinkBody.outwardIssue.key}`)
            .times(2)
            .reply(200, issueBody)
            .get(`/issue/${issueLinkBody.inwardIssue.key}`)
            .times(2)
            .reply(200, issueBody)
            .get(`/issue/BBCOM-123`)
            .times(2)
            .reply(200, issueBody);
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    it('Expect message with list task types for current project IF command !create called without any params', async () => {
        const post = utils.ignoreKeysInProject(projectKey, projectIssueTypes);
        const result = await commands.run(commandName, baseOptions);

        expect(chatApi.sendHtmlMessage).to.be.called;
        expect(result).to.be.eq(post);
    });

    it('Expect message "No name issue" IF command "!create TestTypeTask" called with correct type issue and without new issue name', async () => {
        const post = translate('issueNameExist');
        const result = await commands.run(commandName, { ...baseOptions, bodyText: 'TestTypeTask' });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });

    it.skip('Expect create new issue and receive hook "new link - relates to" IF command "!create TestTypeTask" with correct type issue and correct new issue name', async () => {
        const result = await commands.run(commandName, { ...baseOptions, bodyText: 'TestTypeTask abracadabra' });
        const postNewLinks = new PostNewLinks(config, taskTracker, chatFasade);

        const body = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });

        const data = taskTracker.parser.getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks.run(data);

        expect(result).to.be.undefined;
        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, body.body, body.htmlBody);
    });

    it.skip('Expect create new issue SUB-TASK ', async () => {
        nock.cleanAll();
        nock(taskTracker.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProject)
            .get(`/issue/BBCOM-123`)
            .reply(200, issueBody)
            // issueChild: (summary, issueTypeId, projectId, parentId)
            .post(`/issue`, schemas.issueChild('abracadabra', '10003', '10305', 'BBCOM-123'))
            .reply(201, { key: 'NEW-123' });
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: 'Sub-task abracadabra',
        });

        const post = marked(
            translate('newTaskWasCreated', {
                newIssueKey: 'NEW-123',
                summary: 'abracadabra',
                viewUrl: 'https://jira.test-example.ru/jira/browse/NEW-123',
            }),
        );

        expect(result).not.to.be.undefined;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });
});
