import nock from 'nock';
import { Gitlab } from '../../src/task-trackers/gitlab';
import issueJson from '../fixtures/gitlab-api-requests/issue.json';
import projectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import labelsJson from '../fixtures/gitlab-api-requests/labels.json';
import projectMembersJson from '../fixtures/gitlab-api-requests/project-members.json';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { config } from '../../src/config';
import { pipe, set, clone } from 'lodash/fp';
import { extractKeysFromCommitMessage, transformToKey } from '../../src/task-trackers/gitlab/selectors';

const { expect } = chai;
chai.use(sinonChai);

describe('Gitlab api testing', () => {
    let gitlab: Gitlab;

    const projectNamespace = 'indev';
    const projectKey = 'gitlabtomatrix';
    const issueId = '123';

    const issueKey = projectNamespace + '/' + projectKey + '-' + issueId;

    beforeEach(() => {
        gitlab = new Gitlab({
            url: 'https://gitlab.test-example.ru',
            user: 'gitlab_bot',
            password: 'fakepasswprd',
            features: config.features,
        });
    });

    describe('getIssue test', () => {
        beforeEach(() => {
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson[0].id}/issues/${issueId}`)
                .reply(200, issueJson);
        });

        it('should return Issue body if correct key pass', async () => {
            const issue = await gitlab.getIssue(issueKey);
            const expected = { ...issueJson, key: `${projectNamespace}/${projectKey}-${issueId}` };
            expect(issue).to.be.deep.eq(expected);
        });
    });

    describe('postComment test', () => {
        const bodyText = 'text in body';
        const sender = 'user';

        beforeEach(() => {
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .reply(200, projectsJson)
                .post(`/projects/${projectsJson[0].id}/issues/${issueId}/notes`)
                .query({ body: gitlab.getPostCommentBody(sender, bodyText) })
                .reply(201);
        });

        it('should post comment', async () => {
            const res = await gitlab.postComment(issueKey, { sender }, bodyText);

            expect(res).to.be.eq(gitlab.getPostCommentBody(sender, bodyText));
        });
    });

    describe('getProject test', () => {
        beforeEach(() => {
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson[0].id}/members/all`)
                .reply(200, projectMembersJson);
        });

        it('should return project data', async () => {
            const res = await gitlab.getProject(`${projectNamespace}/${projectKey}`);

            expect(res).to.be.deep.eq({ ...projectsJson[0], lead: projectMembersJson[1].name });
        });
    });

    describe('getWatchers test', () => {
        beforeEach(() => {
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson[0].id}/issues/${issueId}`)
                .reply(200, issueJson);
        });

        it('should return issue author and watchers', async () => {
            const res = await gitlab.getIssueWatchers(issueKey);
            const expected = [(issueJson.assignee as any).name as string, issueJson.author.name];
            expect(res).to.be.deep.eq(expected);
        });
    });

    describe('getCurrentIssueColor', () => {
        it('should return correct color', async () => {
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .times(2)
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson[0].id}/issues/${issueId}`)
                .reply(200, issueJson)
                .get('/projects/3032/labels')
                .reply(200, labelsJson);

            const res = await gitlab.getCurrentIssueColor(issueKey);
            const expected = labelsJson.filter(el => issueJson.labels.includes(el.name)).map(el => el.color);
            expect(res).to.be.deep.eq(expected);
        });

        it('should return only unique colors', async () => {
            const issueJsonWithAllProjectLabels: any = pipe(
                clone,
                set(
                    'labels',
                    labelsJson.map(label => label.name),
                ),
            )(issueJson);
            nock(gitlab.getRestUrl())
                .get(`/projects`)
                .query({ search: `${projectNamespace}/${projectKey}` })
                .times(2)
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson[0].id}/issues/${issueId}`)
                .reply(200, issueJsonWithAllProjectLabels)
                .get('/projects/3032/labels')
                .reply(200, labelsJson);

            const res = await gitlab.getCurrentIssueColor(issueKey);
            const expected = [...new Set(labelsJson.map(el => el.color))];
            expect(res).to.be.deep.eq(expected);
        });
    });

    describe('Commit message parse', () => {
        const id1 = 10;
        const id2 = 20;
        const id3 = 30;
        const projectNamespace = 'indev/gitlabtomatrix';
        const otherProject = 'othernamespace/otherproject';
        const messagePart = [
            'Message',
            '#lalalla',
            '123',
            `#${id1}`,
            `${otherProject}#${id2}`,
            `https://gitlab-example.com/indev/gitlabtomatrix/issues/${id3}`,
        ];
        const expected = [
            transformToKey(projectNamespace, id1),
            transformToKey(projectNamespace, id3),
            transformToKey(otherProject, id2),
        ].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

        it('should return gitlab full key', () => {
            const message = messagePart.join(' ');
            const res = extractKeysFromCommitMessage(message, projectNamespace).sort((a, b) =>
                a.localeCompare(b, 'en', { numeric: true }),
            );
            expect(res).to.deep.eq(expected);
        });
    });
});
