const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const {setIgnoreData} = require('../../src/bot/settings');
const testUtils = require('../test-utils');

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');


describe('ignore test test', () => {
    let chatApi;
    let baseOptions;
    const roomName = 'BBCOM-123';
    const project = 'BBCOM';
    const sender = 'user';
    const roomId = 12345;
    const commandName = 'ignore';

    beforeEach(async () => {
        await setIgnoreData(project, {});
        chatApi = testUtils.getChatApi();
        baseOptions = {roomId, roomName, commandName, sender, chatApi};
        nock(utils.getRestUrl())
            .get(`/project/${project}`)
            .reply(201, {lead: {key: 'user'}, issueTypes: [{name: 'Task'}, {name: 'Error'}]});
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Permition denided', async () => {
        const post = translate('notAdmin', {sender: 'notAdmin'});
        const result = await commandHandler({...baseOptions, bodyText: '', sender: 'notAdmin'});
        expect(result).to.be.eq(post);
    });

    it('Expect empty body - empty list', async () => {
        const post = translate('emptyIgnoreList', {project});
        const result = await commandHandler({...baseOptions, bodyText: ''});
        expect(result).to.be.eq(post);
    });
    it('Expect empty body - full list', async () => {
        await setIgnoreData(project, {taskType: ['Task']});

        const post = utils.getIgnoreTips(project, ['Task']);
        const result = await commandHandler({...baseOptions, bodyText: ''});
        expect(result).to.be.eq(post);
    });
    it('Exist command and empty key', async () => {
        const post = translate('notIgnoreKey', {project});
        const result = await commandHandler({...baseOptions, bodyText: 'add'});
        expect(result).to.be.eq(post);
    });
    it('Exist command and key not in project', async () => {
        const post = utils.ignoreKeysInProject(project, ['Task', 'Error']);
        const result = await commandHandler({...baseOptions, bodyText: 'add abracadabra'});
        expect(result).to.be.eq(post);
    });
    it('Add key, such already added', async () => {
        await setIgnoreData(project, {taskType: ['Task']});

        const post = translate('keyAlreadyExistForAdd', {typeTaskFromUser: 'Task', project});
        const result = await commandHandler({...baseOptions, bodyText: 'add Task'});
        expect(result).to.be.eq(post);
    });
    it('Delete key, not in ignore list', async () => {
        await setIgnoreData(project, {taskType: ['Task']});

        const post = translate('keyNotFoundForDelete', {project});
        const result = await commandHandler({...baseOptions, bodyText: 'del Error'});
        expect(result).to.be.eq(post);
    });
    it('Success add key', async () => {
        const post = translate('ignoreKeyAdded', {project, typeTaskFromUser: 'Error'});
        const result = await commandHandler({...baseOptions, bodyText: 'add Error'});
        expect(result).to.be.eq(post);
    });
    it('Success delete key', async () => {
        await setIgnoreData(project, {taskType: ['Task']});

        const post = translate('ignoreKeyDeleted', {project, typeTaskFromUser: 'Task'});
        const result = await commandHandler({...baseOptions, bodyText: 'del Task'});
        expect(result).to.be.eq(post);
    });
    it('Command not found', async () => {
        const post = translate('commandNotFound');
        const result = await commandHandler({...baseOptions, bodyText: 'abracadabra Error'});
        expect(result).to.be.eq(post);
    });
});
