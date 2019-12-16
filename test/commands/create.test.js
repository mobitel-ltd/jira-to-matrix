const { random } = require('faker');
const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const marked = require('marked');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');

const jiraProject = require('../fixtures/jira-api-requests/project-gens/classic/correct.json');
const postNewLinksbody = require('../fixtures/webhooks/issuelink/created_relates.json');
const issueLinkBody = require('../fixtures/jira-api-requests/issuelinkRelates.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');

const postNewLinks = require('../../src/bot/actions/post-new-links.js');
const { getPostNewLinksData } = require('../../src/jira-hook-parser/parse-body.js');
const { getPostLinkMessageBody } = require('../../src/bot/actions/helper');
const schemas = require('../../src/lib/schemas.js');

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');

describe('create test', () => {
    let chatApi;
    let baseOptions;
    const roomName = `${jiraProject.key}-123`;
    const projectKey = jiraProject.key;
    const projectId = jiraProject.id;
    const sender = jiraProject.lead.name;
    const issueLinkId = postNewLinksbody.issueLink.id;
    const roomId = random.number();
    const commandName = 'create';
    const bodyText = '';
    const { issueTypes } = jiraProject;
    const projectIssueTypes = issueTypes.map(item => item.name);

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        chatApi.getRoomId.withArgs(utils.getInwardLinkKey(issueLinkBody)).resolves(roomId);
        chatApi.getRoomId.withArgs(utils.getOutwardLinkKey(issueLinkBody)).resolves(roomId);
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        nock(utils.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProject)
            .post(`/issue`, schemas.issueNotChild('abracadabra', '10005', projectId))
            .times(2)
            .reply(201, { key: 'BBCOM-123' })
            .post(`/issueLink`, schemas.issueNotChild(roomName, 'BBCOM-123'))
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
        await testUtils.cleanRedis();
    });

    it('Expect message with list task types for current project IF command !create called without any params', async () => {
        const post = utils.ignoreKeysInProject(projectKey, projectIssueTypes);
        const result = await commandHandler(baseOptions);

        expect(chatApi.sendHtmlMessage).to.be.called;
        expect(result).to.be.eq(post);
    });

    it('Expect message "No name issue" IF command "!create TestTypeTask" called with correct type issue and without new issue name', async () => {
        const post = translate('issueNameExist');
        const result = await commandHandler({ ...baseOptions, bodyText: 'TestTypeTask' });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });

    it('Expect create new issue and receive hook "new link - relates to" IF command "!create TestTypeTask" with correct type issue and correct new issue name', async () => {
        const result = await commandHandler({ ...baseOptions, bodyText: 'TestTypeTask abracadabra' });

        const body = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({ ...data, chatApi });

        expect(result).to.be.undefined;
        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, body.body, body.htmlBody);
    });
    it('Expect create new issue SUB-TASK ', async () => {
        nock.cleanAll();
        nock(utils.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProject)
            .get(`/issue/BBCOM-123`)
            .reply(200, issueBody)
            // issueChild: (summary, issueTypeId, projectId, parentId)
            .post(`/issue`, schemas.issueChild('abracadabra', '10003', '10305', 'BBCOM-123'))
            .reply(201, { key: 'NEW-123' });
        const result = await commandHandler({
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
