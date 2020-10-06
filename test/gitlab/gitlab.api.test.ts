import querystring from 'querystring';
import nock from 'nock';
import { Gitlab } from '../../src/task-trackers/gitlab';
import issueJson from '../fixtures/gitlab-api-requests/issue.json';
import projectJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import labelsJson from '../fixtures/gitlab-api-requests/labels.json';
import projectMembersJson from '../fixtures/gitlab-api-requests/project-members.json';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { config } from '../../src/config';
import { pipe, set, clone } from 'lodash/fp';
import { extractKeysFromCommitMessage, transformToKey } from '../../src/task-trackers/gitlab/selectors';
import { Milestone, Colors } from '../../src/task-trackers/gitlab/types';
import { DateTime } from 'luxon';
import { useFakeTimers } from 'sinon';

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
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .reply(200, projectJson)
                .get(`/projects/${projectJson.id}/issues/${issueId}`)
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
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .reply(200, projectJson)
                .post(`/projects/${projectJson.id}/issues/${issueId}/notes`)
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
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .reply(200, projectJson)
                .get(`/projects/${projectJson.id}/members/all`)
                .reply(200, projectMembersJson);
        });

        it('should return project data', async () => {
            const res = await gitlab.getProject(`${projectNamespace}/${projectKey}`);

            expect(res).to.be.deep.eq({ ...projectJson, lead: projectMembersJson[1].name });
        });
    });

    describe('getWatchers test', () => {
        beforeEach(() => {
            nock(gitlab.getRestUrl())
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .reply(200, projectJson)
                .get(`/projects/${projectJson.id}/issues/${issueId}`)
                .reply(200, issueJson);
        });

        it('should return issue author and watchers', async () => {
            const res = await gitlab.getIssueWatchers(issueKey);
            const expected = [
                { displayName: issueJson.assignee.name, userId: issueJson.assignee.username },
                { displayName: issueJson.author.name, userId: issueJson.author.username },
            ];
            expect(res).to.be.deep.eq(expected);
        });
    });

    describe('getMilestonesColors test', () => {
        const body: Milestone = {
            id: 103,
            iid: 10,
            group_id: 736,
            title: 'Тест интеграции',
            description: 'Данный milestone заведен для тестирования интеграции gitlab - matrix',
            state: 'active',
            created_at: '2020-05-26T12:05:30.775Z',
            updated_at: '2020-05-26T12:05:30.775Z',
            due_date: '2020-09-10',
            start_date: '2020-09-01',
            web_url: 'https://gitlab.example.com/groups/indev/gitlabtomatrix/-/milestones/10',
        };

        let clock;

        afterEach(() => {
            clock.restore();
        });

        it('should return only yellow if current date is before start date (upcoming)', async () => {
            const date = DateTime.fromISO(body.start_date!)
                .minus({ days: 2 })
                .toISO();
            clock = useFakeTimers(new Date(date).getTime());
            const res = gitlab.getMilestoneColors(body);
            const expected = [Colors.yellow];
            expect(res).to.be.deep.eq(expected);
        });

        it('should return gray and yellow if current date is between start and end date', async () => {
            const date = DateTime.fromISO(body.start_date!)
                .plus({ days: 3 })
                .toISO();
            clock = useFakeTimers(new Date(date).getTime());
            const res = gitlab.getMilestoneColors(body);
            const expected = Array.from({ length: 10 }, (val, ind) => (ind > 2 ? Colors.green : Colors.gray));
            expect(res).to.be.deep.eq(expected);
        });

        it('should return only gray if current date is after end date', async () => {
            const date = DateTime.fromISO(body.due_date!)
                .plus({ days: 2 })
                .toISO();
            clock = useFakeTimers(new Date(date).getTime());

            const res = gitlab.getMilestoneColors(body);
            const expected = [Colors.gray];
            expect(res).to.be.deep.eq(expected);
        });

        it('should return only gray if current state close', async () => {
            const closedMilestone: Milestone = { ...body, state: 'closed' };
            const res = gitlab.getMilestoneColors(closedMilestone);
            const expected = [Colors.gray];
            expect(res).to.be.deep.eq(expected);
        });

        // beforeEach(() => {
        //     var end = DateTime.fromISO('2017-03-13');
        //     var start = DateTime.fromISO('2017-02-13');

        //     var diffInMonths = end.diff(start, 'months');
        //     diffInMonths.toObject(); //=> { months: 1 }

        //     // it's always May 25
        //     Settings.now = () => new Date(2018, 4, 25).valueOf();
        //     DateTime.local().toISO(); //=> "2018-05-25T00:00:00.000-04:00"
        // });

        // it('should return MilestoneDaysAllocated', async () => {
        //     const res = await gitlab.getMilestoneAllocatedDays(issueKey);
        //     const expected = // [(issueJson.assignee as any).name as string, issueJson.author.name];
        //     expect(res).to.be.deep.eq(expected);
        // });

        // it('should return MilestoneCurrentDays', async () => {
        //     const res = await gitlab.getMilestoneCurrentDays(issueKey);
        //     const expected = ''
        //     expect(res).to.be.deep.eq(expected);
        // });
    });

    describe('getCurrentIssueColor', () => {
        it('should return correct color', async () => {
            nock(gitlab.getRestUrl())
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .times(2)
                .reply(200, projectJson)
                .get(`/projects/${projectJson.id}/issues/${issueId}`)
                .reply(200, issueJson)
                .get(`/projects/${projectJson.id}/labels`)
                .query({ per_page: 100 })
                .reply(200, labelsJson)
                .get('/groups')
                .query({ search: projectJson.namespace.path })
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
                .get(`/projects/${querystring.escape(`${projectNamespace}/${projectKey}`)}`)
                .times(2)
                .reply(200, projectJson)
                .get(`/projects/${projectJson.id}/issues/${issueId}`)
                .reply(200, issueJsonWithAllProjectLabels)
                .get(`/projects/${projectJson.id}/labels`)
                .query({ per_page: 100 })
                .reply(200, labelsJson)
                .get('/groups')
                .query({ search: projectJson.namespace.path })
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
