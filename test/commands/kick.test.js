const faker = require('faker');
const config = require('../../src/config');

const commandHandler = require('../../src/bot/commands');
const { USER_OPTION, ALL_OPTION } = require('../../src/bot/commands/command-list/kick');
const { getUserIdByDisplayName } = require('../test-utils');
const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');
const projectJSON = require('../fixtures/jira-api-requests/project.json');

const utils = require('../../src/lib/utils');

describe('Kick command', () => {
    const kickAllOption = `--${ALL_OPTION}`;
    const kickUserOption = `--${USER_OPTION}`;
    let chatApi;
    const sender = getUserIdByDisplayName(issueJSON.fields.creator.displayName);
    const roomId = testUtils.getRoomId();
    const commandName = 'kick';
    let baseOptions;
    let roomNameNotGitProject;
    let notExistProject;
    const notAdminSender = 'notAdmin';
    const [adminSender] = testUtils.roomAdmins;
    const projectKey = 'MYPROJECTKEY';
    const issueKey = `${projectKey}-123`;
    let roomData;
    let baseMembers;
    let simpleMembers;

    const userToKick = 'member1';
    const adminId = 'member3';

    beforeEach(() => {
        notExistProject = faker.name.firstName().toUpperCase();
        roomNameNotGitProject = `${notExistProject}-123`;
        chatApi = testUtils.getChatApi({ existedUsers: [notAdminSender] });
        simpleMembers = [
            {
                userId: chatApi.getChatUserId(userToKick),
                powerLevel: 0,
            },
            {
                userId: chatApi.getChatUserId('member2'),
                powerLevel: 50,
            },
        ];

        const admin = [
            {
                userId: chatApi.getChatUserId(adminId),
                powerLevel: 100,
            },
        ];

        baseMembers = [...simpleMembers, ...admin];

        roomData = {
            alias: issueKey,
            topic: 'room topic',
            name: 'room name',
            id: roomId,
            members: [
                ...baseMembers,
                {
                    userId: chatApi.getChatUserId(chatApi.getMyId()),
                    powerLevel: 100,
                },
            ],
        };
        baseOptions = {
            config,
            roomId,
            commandName,
            sender,
            chatApi,
            roomData,
        };
        nock(utils.getRestUrl())
            .get(`/issue/${issueJSON.key}`)
            .reply(200, issueJSON)
            .get(`/issue/${issueKey}`)
            .reply(200, issueJSON)
            .get(`/issue/${roomNameNotGitProject}`)
            .reply(200, issueJSON)
            .get(`/project/${projectKey}`)
            .reply(200, projectJSON);
    });

    afterEach(async () => {
        nock.cleanAll();
        await testUtils.cleanRedis();
    });

    // TODO set readable test case names
    it('should return notAdmin for not admin users', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, bodyText: kickAllOption, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('should return setBotToAdmin if bot has less than 100 prio level', async () => {
        const post = translate('noBotPower', { power: 100 });
        const roomDataWihLessPower = {
            ...roomData,
            members: [
                ...baseMembers,
                {
                    userId: `@${chatApi.getMyId()}:matrix.test.com`,
                    powerLevel: 99,
                },
            ],
        };
        const result = await commandHandler({
            ...baseOptions,
            roomData: roomDataWihLessPower,
            bodyText: kickAllOption,
        });
        expect(result).to.be.eq(post);
    });

    it('Permition denided if sender and bot not in task jira', async () => {
        const post = translate('issueNotExistOrPermDen');
        const notAvailableIssueKey = `${projectKey}-1010`;
        const roomDataWithNotExistAlias = { ...roomData, alias: notAvailableIssueKey };
        const result = await commandHandler({
            ...baseOptions,
            bodyText: kickAllOption,
            roomData: roomDataWithNotExistAlias,
        });
        expect(result).to.be.eq(post);
    });

    it('expect return notFoundUser message if body text have not exist in room user', async () => {
        const user = 'lallaal';
        const result = await commandHandler({
            ...baseOptions,
            bodyText: [kickUserOption, user].join(' '),
        });
        expect(result).to.be.eq(translate('notFoundUser', { user }));
    });

    it('expect return noSelfKick message if option to kick user passed with bot id', async () => {
        const user = chatApi.getMyId();
        const result = await commandHandler({
            ...baseOptions,
            bodyText: [kickUserOption, user].join(' '),
        });
        expect(result).to.be.eq(translate('noSelfKick'));
    });

    it('expect return unknownArgs message if body text have extra data exept command options', async () => {
        const text = 'lallaal';
        const result = await commandHandler({
            ...baseOptions,
            bodyText: [text, kickAllOption].join(' '),
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: text }));
    });

    it('expect return oneOptionOnly message if both command options are used', async () => {
        const result = await commandHandler({
            ...baseOptions,
            bodyText: [kickUserOption, kickAllOption].join(' '),
        });
        expect(result).to.be.eq(translate('oneOptionOnly'));
    });

    it('expect return noOptionArg message if both command options are used', async () => {
        const result = await commandHandler({
            ...baseOptions,
            bodyText: kickUserOption,
        });
        expect(result).to.be.eq(translate('noOptionArg', { option: USER_OPTION }));
    });

    it('expect return noOptions message if no options exists', async () => {
        const result = await commandHandler({
            ...baseOptions,
            bodyText: '',
        });
        expect(result).to.be.eq(translate('noOptions'));
    });

    it('expect command succeded with --all option', async () => {
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            roomName: issueKey,
            bodyText: kickAllOption,
        });

        expect(result).to.be.eq(translate('allKicked'));
        simpleMembers.forEach(({ userId }) =>
            expect(chatApi.kickUserByRoom).to.be.calledWithExactly({ roomId, userId }),
        );
    });

    it('expect command succeded with kick user option', async () => {
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            roomName: issueKey,
            bodyText: [kickUserOption, userToKick].join(' '),
        });

        expect(result).to.be.eq(translate('userKicked', { userId: userToKick }));

        expect(chatApi.kickUserByRoom).to.be.calledWithExactly({ roomId, userId: chatApi.getChatUserId(userToKick) });
    });

    it('expect command is no succeded if user to kick is admin', async () => {
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            roomName: issueKey,
            bodyText: [kickUserOption, adminId].join(' '),
        });

        expect(result).to.be.eq(translate('forbiddenAdminKick', { userId: adminId }));
    });
});
