const jiraRequest = require('../src/utils');
const {checkCommand, BASE_URL} = require('../src/matrix/timeline-handler/commands/helper.js');
const translate = require('../src/locales');
const {auth} = require('../src/jira');

const assert = require('assert');
const logger = require('../src/modules/log.js')(module);

describe('Matrix api', async function() {
    this.timeout(15000);
    const getMoveId = async (body, roomName) => {
        // List of available commands
        const {transitions} = await jiraRequest.fetchJSON(
            `${BASE_URL}/${roomName}/transitions`,
            auth()
        );
    
        if (!transitions) {
            throw new Error(`Jira not return list transitions for ${roomName}`);
        }
        logger.debug('transitions', transitions);
    
        const moveId = transitions.reduce((acc, {name, id}, index) => {
            // check command
            if (checkCommand(body, name, index)) {
                return {name, id};
            }
    
            const postListCommands = `${{name, id}}&nbsp;&nbsp;${index + 1})&nbsp;${name}<br>`;
    
            return `<b>${translate('listJiraCommand')}:</b><br>${postListCommands}`;
        }, {});
    
    
        return moveId;
    };
    
    it('test matrix true config connect from sdk-client', async () => {
        const body = '!move';
        const roomName = 'BBCOM-1233';
        const result = await getMoveId(body, roomName);
        assert.equal(result, 'smyh');
    });
});
