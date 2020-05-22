import nock from 'nock';
import * as utils from '../../src/lib/utils';
import { translate } from '../../src/locales';
import edimetaJSON from '../fixtures/jira-api-requests/editmeta.json';
import { commandsHandler } from '../../src/bot/commands';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { getChatClass, taskTracker } from '../test-utils';

const { expect } = chai;
chai.use(sinonChai);

describe('Prio command test', () => {
    let baseOptions;
    let chatApi;

    const allPriorities = edimetaJSON.fields.priority.allowedValues;
    const [priority] = allPriorities;
    const roomId = 12345;

    const roomName = 'BBCOM-123';

    const commandName = 'prio';

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;
        baseOptions = { roomId, roomName, commandName, chatApi, taskTracker };

        nock(utils.getRestUrl())
            .get(`/issue/${roomName}/editmeta`)
            .reply(200, edimetaJSON)
            .put(`/issue/${roomName}`, schemas.fields(priority.id))
            .reply(201);
    });

    it('Expect prio show all priorities with empty body ("!prio")', async () => {
        const post = utils.getCommandList(allPriorities);
        const result = await commandsHandler({ ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct ("!prio 1")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandsHandler({ ...baseOptions, bodyText: priority.id });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct with word command even in upper case("!prio HIGHEST")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandsHandler({ ...baseOptions, bodyText: priority.name.toUpperCase() });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command send message about not found command ("!prio fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundPrio', { bodyText });
        const result = await commandsHandler({ ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
