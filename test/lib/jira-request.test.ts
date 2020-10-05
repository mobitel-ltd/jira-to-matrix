import * as assert from 'assert';
import * as Ramda from 'ramda';
import nock from 'nock';
import renderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import watchersJSON from '../fixtures/jira-api-requests/watchers.json';
import issueJSON from '../fixtures/jira-api-requests/issue.json';

import classicProject from '../fixtures/jira-api-requests/project-gens/classic/correct.json';
import newgenProject from '../fixtures/jira-api-requests/project-gens/new-gen/correct.json';
import adminsProject from '../fixtures/jira-api-requests/project-gens/admins-project.json';
import { Jira } from '../../src/task-trackers/jira';
import { config } from '../../src/config';
import { getRequestErrorLog } from '../../src/lib/messages';
import { stub } from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { taskTracker } from '../test-utils';

const { expect } = chai;
chai.use(sinonChai);

// ii_ivanov pp_petrov bb_borisov
const watchers = watchersJSON.watchers
    .map(({ displayName }) => displayName !== 'jira_bot' && displayName)
    .filter(Boolean) as string[];

// ii_ivanov ao_fedorov oo_orlov
const members = [
    issueJSON.fields.reporter.displayName,
    issueJSON.fields.creator.displayName,
    issueJSON.fields.assignee.displayName,
];

const expectedWatchersUsers = [...new Set([...watchers, ...members])].sort();
describe('Jira request test', () => {
    const jiraApi = new Jira({
        url: config.taskTracker.url,
        password: config.taskTracker.password,
        user: config.taskTracker.user,
        count: config.ping && config.ping.count,
        interval: config.ping && config.ping.interval,
        inviteIgnoreUsers: config.usersToIgnore,
        features: config.features,
    });

    const users = [
        {
            displayName: 'Ivan Andreevich A',
            name: 'ia_a',
        },
        {
            displayName: 'Ivan Sergeevich B',
            name: 'is_b',
        },
        {
            displayName: 'Anton Matveevich C',
            name: 'am_c',
        },
        {
            displayName: 'Petr Andreevich D',
            name: 'pa_d',
        },
    ];

    const issue = {
        id: '26313',
        key: 'ABC',
    };
    const [COMMON_NAME] = config.messenger.domain.split('.').slice(1, 2);

    const params = {
        username: COMMON_NAME,
        startAt: 0,
        maxResults: 3,
    };
    const errorParams = { ...params, startAt: 5 };
    const errorStatus = 400;

    before(() => {
        nock(taskTracker.getRestUrl())
            .get(`/project/INDEV`)
            .reply(200, newgenProject)
            .get(`/issue/${issue.key}`)
            .times(5)
            .reply(200, issueJSON)
            .get(`/issue/${issue.key}`)
            .query(Jira.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${issue.key}/watchers`)
            .times(5)
            .reply(200, watchersJSON)
            .get('/user/search')
            .query(errorParams)
            .reply(errorStatus, 'ERROR!!!')
            .get('/user/search')
            .query({ ...params, startAt: 3 })
            .reply(200, users.slice(3))
            .get('/user/search')
            .query(params)
            .reply(200, users.slice(0, 3));
    });

    after(() => {
        nock.cleanAll();
    });

    it('Default or not default', async () => {
        const checkProjectRoom = await jiraApi.isJiraPartExists('INDEV-123');
        expect(checkProjectRoom).to.be.true;
        const checkNotProjectRoom = await jiraApi.isJiraPartExists('hjshhhhd');
        expect(checkNotProjectRoom).to.be.false;
    });

    it('getIssueFieldsValues test', async () => {
        const getRenderedValuesData = await jiraApi.getIssueFieldsValues(issue.key, ['description']);
        expect(getRenderedValuesData).to.be.deep.equal({ description: renderedIssueJSON.renderedFields.description });
    });

    it('getViewUrl test', () => {
        const projectResult = taskTracker.getViewUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal(`${config.taskTracker.url}/projects/${issue.id}`);

        const issueResult = taskTracker.getViewUrl(issue.id);
        expect(issueResult).to.be.deep.equal(`${config.taskTracker.url}/browse/${issue.id}`);
    });

    it('expect getIssueWatchers works correct', async () => {
        const result = await jiraApi.getIssueWatchers(issue.key);
        expect(result).to.have.length(expectedWatchersUsers.length);
        result.forEach(el => expect(expectedWatchersUsers.some(one => one === el.displayName)).to.be.true);
    });

    it('expect getIssueWatchers works correct with empty roomMembers', async () => {
        const result = await jiraApi.getIssueWatchers(issue.key);
        expect(result).to.have.length(expectedWatchersUsers.length);
        result.forEach(el => expect(expectedWatchersUsers.some(one => one === el.displayName)).to.be.true);
    });

    it('expect getIssueWatchers avoid users from ignore invite list', async () => {
        const jiraApi_ = new Jira({
            url: config.taskTracker.url,
            password: config.taskTracker.password,
            user: config.taskTracker.user,
            count: config.ping && config.ping.count,
            interval: config.ping && config.ping.interval,
            inviteIgnoreUsers: watchers,
            features: config.features,
        });

        const result = await jiraApi_.getIssueWatchers(issue.key);

        const expected = Ramda.difference(members, watchers);
        expect(result).to.have.length(expected.length);
        result.forEach(el => expect(expected.some(one => one === el.displayName)).to.be.true);
    });

    it('expect getIssueWatchers avoid users from ignore invite list2', async () => {
        const [addUser, ...usersToIgnore] = members;
        const expected = Ramda.difference([...watchers, addUser], usersToIgnore);
        const jiraApi_ = new Jira({
            url: config.taskTracker.url,
            password: config.taskTracker.password,
            user: config.taskTracker.user,
            count: config.ping && config.ping.count,
            interval: config.ping && config.ping.interval,
            inviteIgnoreUsers: usersToIgnore,
            features: config.features,
        });

        const result = await jiraApi_.getIssueWatchers(issue.key);
        expect(result).to.have.length(expected.length);
        result.forEach(el => expect(expected.some(one => one === el.displayName)));
    });

    it('checkUser test', () => {
        const user = 'My Test User';
        const result = [
            jiraApi.checkUser(user, 'My'),
            jiraApi.checkUser(user, 'MY TEST'),
            jiraApi.checkUser(user, 'test'),
            jiraApi.checkUser(user, '_NAMe'),
            jiraApi.checkUser(user, '_NMe'),
        ];
        expect(result).to.deep.equal([true, true, true, false, false]);
    });

    describe('getProject', () => {
        const expectedClassicProject = {
            id: classicProject.id,
            key: classicProject.key,
            name: classicProject.name,
            lead: classicProject.lead.displayName,
            adminsURL: classicProject.roles.Administrators,
            issueTypes: [
                {
                    id: '10002',
                    name: 'Задача',
                    description: 'Задание для выполнения.',
                    subtask: false,
                },
                {
                    id: '10003',
                    name: 'Sub-task',
                    description: 'Подзадача задачи.',
                    subtask: true,
                },
                { id: '10001', name: 'История', description: '', subtask: false },
                { id: '10004', name: 'Баг', description: '', subtask: false },
                {
                    id: '10000',
                    name: 'Эпик',
                    subtask: false,
                    description:
                        'Создано через Jira Software — не редактировать и не удалять. Это тип задачи нужен для большой пользовательской истории, которая требует упорядочивания.',
                },
                {
                    id: '10005',
                    description: 'Created for testing',
                    name: 'TestTypeTask',
                    subtask: false,
                },
            ],
            isIgnore: false,
            style: 'classic',
        };

        const expectedNewgenProject = {
            id: newgenProject.id,
            key: newgenProject.key,
            name: newgenProject.name,
            lead: newgenProject.lead.displayName,
            adminsURL: newgenProject.roles.Administrator,
            issueTypes: [
                { id: '10349', name: 'История', subtask: false, description: '' },
                {
                    id: '10350',
                    name: 'Эпик',
                    subtask: false,
                    description:
                        'Создано через Jira Software — не редактировать и не удалять. Это тип задачи нужен для большой пользовательской истории, которая требует упорядочивания.',
                },
            ],
            isIgnore: false,
            style: 'next-gen',
        };

        before(() => {
            nock(taskTracker.getRestUrl())
                .get(`/project/${classicProject.id}`)
                .times(2)
                .reply(200, classicProject)
                .get(`/project/${newgenProject.id}`)
                .times(2)
                .reply(200, newgenProject)
                .get(`/project/${classicProject.id}/role/10002`)
                .reply(200, adminsProject)
                .get(`/project/${newgenProject.id}/role/10618`)
                .reply(200, adminsProject);
        });

        after(() => {
            nock.cleanAll();
        });

        it('check classic project', async () => {
            const project = await jiraApi.getProject(classicProject.id);

            expect(project).to.be.deep.eq(expectedClassicProject);
        });

        it('check classic project with admins', async () => {
            const project = await jiraApi.getProjectWithAdmins(classicProject.id);

            expect(project).to.be.deep.eq({
                ...expectedClassicProject,
                admins: adminsProject.actors.map(item => item.displayName),
            });
        });

        it('check newgen project', async () => {
            const project = await jiraApi.getProject(newgenProject.id);

            expect(project).to.be.deep.eq(expectedNewgenProject);
        });

        it('check newgen project with admins', async () => {
            const project = await jiraApi.getProjectWithAdmins(newgenProject.id);

            expect(project).to.be.deep.eq({
                ...expectedNewgenProject,
                admins: adminsProject.actors.map(item => item.displayName),
            });
        });
    });
});

describe('request testing', () => {
    const jiraApi = new Jira({
        url: config.taskTracker.url,
        password: config.taskTracker.password,
        user: config.taskTracker.user,
        count: config.ping && config.ping.count,
        interval: config.ping && config.ping.interval,
        inviteIgnoreUsers: config.usersToIgnore,
        features: config.features,
    });

    const urlPath = '12345';
    const fakePath = 'error';
    const body = { result: true };

    before(() => {
        nock(taskTracker.getRestUrl())
            .get(`/${urlPath}`)
            .reply(200, body)
            .get(`/${fakePath}`)
            .reply(400, 'Bad Request');
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect request works', async () => {
        const testUrl = taskTracker.getRestUrl(urlPath);
        const result = await jiraApi.request(testUrl);

        assert.deepEqual(result, body);
    });

    it('test request with error url', async () => {
        const testUrl = taskTracker.getRestUrl(fakePath);
        let res;
        const expected = getRequestErrorLog(testUrl, 400, 'GET', null);

        try {
            await jiraApi.request(testUrl);
        } catch (err) {
            res = err;
        }
        assert.deepEqual(res, expected);
    });

    it('connect any times (7)', async () => {
        const func = stub();
        func.rejects('Some error');
        func.onCall(7).resolves();
        await jiraApi._connect(func, 100, 10);

        expect(func).to.be.callCount(8);
    });

    it('connect more 10 time and error', async () => {
        const func = stub();
        func.rejects('Some error');
        const countCall = 10;
        try {
            await jiraApi._connect(func, 10, countCall);
        } catch (err) {
            expect(err.message).to.be.equal('No connection.');
        }
        expect(func).to.be.callCount(countCall);
    });
});
