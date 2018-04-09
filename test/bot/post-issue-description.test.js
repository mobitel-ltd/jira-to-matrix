const nock = require('nock');
const {auth} = require('../../src/jira/common');
const JSONbody = require('../fixtures/create.json');
const {getCreateRoomData} = require('../../src/queue/parse-body.js');
const issueBody = require('../fixtures/response.json');
const logger = require('../../src/modules/log.js')(module);
const proxyquire = require('proxyquire');
const projectData = require('../fixtures/project-example.json');
const htmlToText = require('html-to-text').fromString;

const chai = require('chai');
const {stub, spy} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const loggerSpy = {
    error: spy(),
    warn: spy(),
    debug: spy(),
    info: spy(),
};
const translateStub = stub();
const postIssueDescription = proxyquire('../../src/bot/post-issue-description.js', {
    '../modules/log.js': () => loggerSpy,
    '../locales': translateStub,
});

describe('Create room test', () => {
    const newRoomID = 'roomId';
    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EpicKey",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const epicResponse = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/1000122",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };
    const expectedOptions = {
        room_alias_name: 'BBCOM-1398',
        invite: ['@jira_test:matrix.bingo-boom.ru'],
        name: 'BBCOM-1398 Test',
        topic: 'https://jira.bingo-boom.ru/jira/browse/BBCOM-1398'
    };

    const sendHtmlMessageStub = spy();
    const getRoomIdStub = stub().returns('id');
    const createRoomStub = stub().returns('correct room');

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
        createRoom: createRoomStub,
    };

    const createRoomData = getCreateRoomData(JSONbody);

    const {assigneeName,
        assigneeEmail,
        reporterName,
        reporterEmail,
        typeName,
        epicLink,
        estimateTime,
        description,
        priority,
    } = createRoomData.issue.descriptionFields;

    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';
    const expectedHTMLBody = `
            Assignee:
                <br>${indent}${assigneeName}
                <br>${indent}${assigneeEmail}<br>
            <br>Reporter:
                <br>${indent}${reporterName}
                <br>${indent}${reporterEmail}<br>
            <br>Type:
                <br>${indent}${typeName}<br>
            <br>Estimate time:
                <br>${indent}${estimateTime}<br>
            <br>Description:
                <br>${indent}${description}<br>
            <br>Priority:
                <br>${indent}${priority}<br>
            <br>Epic link:
                <br>${indent}undefined (BBCOM-801)
                <br>${indent}\thttps://jira.bingo-boom.ru/jira/browse/BBCOM-801<br>`;

    const expectedBody = htmlToText(expectedHTMLBody);

    const expetcedTutorial = `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `;

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
            .times(5)
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(`/jira/rest/api/2/project/10305`)
            .times(5)
            .reply(200, projectData)
            .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
            .times(5)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Description with epic should be created', async () => {
        await postIssueDescription({mclient, ...createRoomData, newRoomID});
        logger.debug(sendHtmlMessageStub.secondCall.args);
        expect(sendHtmlMessageStub.firstCall.args).to.be.deep.equal([newRoomID, expectedBody, expectedHTMLBody]);
        expect(sendHtmlMessageStub.secondCall).to.have.been.calledWith(newRoomID, 'Send tutorial', expetcedTutorial);
    });

    it('Description with error', async () => {
        translateStub.throws('ERROR!!!');
        try {
            await postIssueDescription({mclient, ...createRoomData, newRoomID});
        } catch (error) {
            const expectedError = [
                'post issue description error',
                'Error in getPost',
                'ERROR!!!',
            ].join('\n');
            expect(error).to.be.equal(expectedError)
        }

    });
});
