const htmlToString = require('html-to-text').fromString;
const nock = require('nock');
const {auth, issueFormatedParams, getRestUrl} = require('../../src/lib/utils.js');
const {getCommentHTMLBody, getCommentBody} = require('../../src/bot/helper');
const JSONbody = require('../fixtures/comment-create-1.json');
const {getPostCommentData} = require('../../src/jira-hook-parser/parse-body.js');
const {postComment} = require('../../src/bot');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post comments test', () => {
    const someError = 'Error!!!';
    const matrixRoomId = 'matrixRoomId';
    const postCommentData = getPostCommentData(JSONbody);

    const issue = {
        id: postCommentData.issueID,
        self: getRestUrl('issue', postCommentData.issueID),
        key: 'EX-1',
    };
    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub().withArgs(issue.key).resolves(matrixRoomId),
    };

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/${postCommentData.issueID}`)
            .query(issueFormatedParams)
            .times(2)
            .reply(200, issue);
    });

    afterEach(() => {
        Object.values(mclient).map(val => val.reset());
    });

    it('Get links', async () => {
        const htmlBody = getCommentHTMLBody(postCommentData.headerText, getCommentBody(issue, postCommentData.comment));

        const result = await postComment({mclient, ...postCommentData});
        expect(result).to.be.true;
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(matrixRoomId, htmlToString(htmlBody), htmlBody);
    });

    it('Expect return with empty issueID. No way to handle issue', async () => {
        const res = await postComment({mclient, ...postCommentData, issueID: null});
        expect(res).to.be.undefined;
    });

    it('Expect postComment throw error if room is not exists', async () => {
        mclient.getRoomId.throws(someError);
        try {
            await postComment({mclient, ...postCommentData});
        } catch (err) {
            expect(err).to.include(someError);
        }
    });
});
