const nock = require('nock');
const querystring = require('querystring');
const proxyquire = require('proxyquire');

const utils = require('../../src/lib/utils.js');
const { expect } = require('chai');
const {
    getRenderedValues,
    getIssueWatchers,
    getUsers,
    checkUser,
    getProject,
    getProjectWithAdmins,
} = require('../../src/lib/jira-request');
const { getRequestErrorLog } = require('../../src/lib/messages');
const { url } = require('../../src/config').jira;
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const watchersJSON = require('../fixtures/jira-api-requests/watchers.json');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');

const classicProject = require('../fixtures/jira-api-requests/project-gens/classic/correct.json');
const newgenProject = require('../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const adminsProject = require('../fixtures/jira-api-requests/project-gens/admins-project.json');

// ii_ivanov pp_petrov bb_borisov
const watchers = watchersJSON.watchers.map(({ name }) => name);
// ii_ivanov ao_fedorov oo_orlov
const members = [issueJSON.fields.reporter.name, issueJSON.fields.creator.name, issueJSON.fields.assignee.name];
const expectedWatchersUsers = [...new Set([...watchers, ...members])].sort();
describe('Jira request test', () => {
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
        id: 26313,
        key: 'ABC',
    };
    const fakeKey = 'NANANAN';

    const params = {
        username: utils.COMMON_NAME,
        startAt: 0,
        maxResults: 3,
    };
    const errorParams = { ...params, startAt: 5 };
    const errorStatus = 400;

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${issue.key}`)
            .times(5)
            .reply(200, issueJSON)
            .get(`/issue/${issue.key}`)
            .query(utils.expandParams)
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

    it('getRenderedValues test', async () => {
        const getRenderedValuesData = await getRenderedValues(issue.key, ['description']);
        expect(getRenderedValuesData).to.be.deep.equal({ description: renderedIssueJSON.renderedFields.description });
    });

    it('getRenderedValues error test', async () => {
        const fakeUrl = utils.getRestUrl('issue', fakeKey);
        const expectedData = [
            'getRenderedValues error',
            'getIssueFormatted Error',
            'Error in get issue',
            getRequestErrorLog(fakeUrl),
        ];
        try {
            await getRenderedValues(fakeKey, ['description']);
        } catch (error) {
            expect(error).to.be.deep.equal(expectedData.join('\n'));
        }
    });

    it('getViewUrl test', () => {
        const projectResult = utils.getViewUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal(`${url}/projects/${issue.id}`);

        const issueResult = utils.getViewUrl(issue.id);
        expect(issueResult).to.be.deep.equal(`${url}/browse/${issue.id}`);
    });

    it('expect getIssueWatchers works correct', async () => {
        const result = await getIssueWatchers({ key: issue.key });
        expect(result.sort()).to.be.deep.eq([...expectedWatchersUsers]);
    });

    it('expect getIssueWatchers works correct with empty roomMembers', async () => {
        const result = await getIssueWatchers({ key: issue.key });
        expect(result.sort()).to.be.deep.eq(expectedWatchersUsers);
    });

    it('expect getIssueWatchers avoid users from ignore invite list', async () => {
        const { getIssueWatchers: getCollectParticipantsProxy } = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: ['pp_petrov', 'bb_borisov'],
            },
        });
        const result = await getCollectParticipantsProxy({ key: issue.key });
        expect(result.sort()).to.be.deep.eq(members.sort());
    });

    it('expect getIssueWatchers avoid users from ignore invite list2', async () => {
        const { getIssueWatchers: getCollectParticipantsProxy } = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: expectedWatchersUsers,
            },
        });
        const result = await getCollectParticipantsProxy({ key: issue.key });
        expect(result.sort()).to.be.deep.eq([]);
    });

    it('Expect getUsers returns correct users witn right length', async () => {
        const maxResults = 3;
        const startAt = 0;
        const allUsers = await getUsers(maxResults, startAt);

        expect(allUsers).to.be.deep.equal(users);
    });

    it('Expect getUsers test throws error if start is incorrect', async () => {
        const maxResults = 3;
        const startAt = 5;
        const fakeUrl = utils.getRestUrl('user', `search?${querystring.stringify(errorParams)}`);
        const expected = [utils.getDefaultErrorLog('getUsers'), getRequestErrorLog(fakeUrl, errorStatus)].join('\n');

        let allUsers;
        let res;
        try {
            allUsers = await getUsers(maxResults, startAt);
        } catch (err) {
            res = err;
        }

        expect(allUsers).to.be.undefined;
        expect(res).to.be.deep.equal(expected);
    });

    it('checkUser test', () => {
        const user = {
            name: 'test_name',
            displayName: 'My Test User',
        };
        const result = [
            checkUser(user, 'My'),
            checkUser(user, 'MY TEST'),
            checkUser(user, 'test'),
            checkUser(user, '_NAMe'),
            checkUser(user, '_NMe'),
        ];
        expect(result).to.deep.equal([true, true, true, true, false]);
    });

    describe('getProject', () => {
        const expectedClassicProject = {
            id: classicProject.id,
            key: classicProject.key,
            name: classicProject.name,
            lead: { name: 'jira_test', key: 'jira_test' },
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
            lead: { name: 'jira_test', key: 'jira_test' },
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
            nock(utils.getRestUrl())
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
            const project = await getProject(classicProject.id);

            expect(project).to.be.deep.eq(expectedClassicProject);
        });

        it('check classic project with admins', async () => {
            const project = await getProjectWithAdmins(classicProject.id);

            expect(project).to.be.deep.eq({ ...expectedClassicProject, admins: [{ id: 11891, name: 'ii_ivanov' }] });
        });

        it('check newgen project', async () => {
            const project = await getProject(newgenProject.id);

            expect(project).to.be.deep.eq(expectedNewgenProject);
        });

        it('check newgen project with admins', async () => {
            const project = await getProjectWithAdmins(newgenProject.id);

            expect(project).to.be.deep.eq({ ...expectedNewgenProject, admins: [{ id: 11891, name: 'ii_ivanov' }] });
        });
    });
});
