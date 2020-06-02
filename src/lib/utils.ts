import * as R from 'ramda';
import { translate } from '../locales';
import * as messages from './messages';
import { NO_ROOM_PATTERN, END_NO_ROOM_PATTERN, INDENT } from './consts';

// TODO: change until start correct bot work

// * --------------------------------- Error handling ---------------------------- *

export const getDefaultErrorLog = funcName => `Error in ${funcName}`;

export const errorTracing = (name, err = '') => {
    const log = messages[name] || getDefaultErrorLog(name);

    return [log, err].join('\n');
};

// * --------------------------------- Matrix utils ------------------------------- *

export const getKeyFromError = str => {
    const start = str.indexOf(NO_ROOM_PATTERN) + NO_ROOM_PATTERN.length;
    const end = str.indexOf(END_NO_ROOM_PATTERN);
    return str.slice(start, end);
};

export const isNoRoomError = errStr => errStr.includes(NO_ROOM_PATTERN);

// * --------------------------------- Other utils ------------------------------- *

export const isOdd = num => Boolean(num % 2);

export const getProjectKeyFromIssueKey = issueKey => R.head(issueKey.split('-'));

export const getListToHTML = list =>
    list.reduce((acc, { displayName }) => `${acc}<strong>${displayName}<br>`, `${translate('listUsers')}:<br>`);

export const getCommandList = list =>
    list.reduce(
        (acc, { name }, index) => `${acc}<strong>${index + 1})</strong> - ${name}<br>`,
        `${translate('listJiraCommand')}:<br>`,
    );

export const getIgnoreTips = (projectKey, currentSettingsList, command) => {
    if (currentSettingsList.length === 0) {
        return `${translate('emptySettingsList', { projectKey })}`;
    }
    switch (command) {
        case 'ignore':
            return `${translate('currentIgnoreSettings', { projectKey })}
                <br>
                ${currentSettingsList.map((name, id) => `<strong>${id + 1})</strong> - ${name}`).join('<br>')}
                    <br>
                    ${translate('varsComandsIgnoreSettings')}`;
        case 'autoinvite':
            return `${translate('currentInviteSettings', { projectKey })}
                    <br>
                    ${currentSettingsList
                        .map(([name, userList]) => {
                            const result =
                                userList.length > 0 ? `<strong>${name})</strong>:<br> ${userList.join('<br>')}` : '';
                            return result;
                        })
                        .filter(Boolean)
                        .join('<br>')}
                    <br>
                    ${translate('varsComandsInviteSettings')}`;
    }
};

export const getNameFromMail = mail => mail && mail.split('@')[0];

export const ignoreKeysInProject = (projectKey, namesIssueTypeInProject) => `${translate('notKeyInProject', {
    projectKey,
})}
                <br>
                ${namesIssueTypeInProject.map((name, id) => `<strong>${id + 1})</strong> - ${name}`).join('<br>')}
                `;

export const timing = (startTime, now = Date.now()) => {
    const timeSync = Math.floor((now - startTime) / 1000);
    const min = Math.floor(timeSync / 60);
    const sec = timeSync % 60;
    return { min, sec };
};

export const helpPost = `
    <h5>Use "!comment" command to comment in jira issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!comment some text</strong></font><br>
        ${INDENT}text "<font color="green">some text</font>" will be shown in jira comments<br>
    <h5>Use "!assign" command to assign jira issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!assign mv_nosak</strong></font>
        or <font color="green"><strong>!assign Носак</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' will become assignee for the issue<br><br>
        ${INDENT}<font color="green"><strong>!assign</strong></font><br>
        ${INDENT}you will become assignee for the issue
    <h5>Use "!move" command to view list of available transitions<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!move</strong></font><br>
        ${INDENT}you will see a list:<br>
        ${INDENT}${INDENT}1) Done<br>
        ${INDENT}${INDENT}2) On hold<br>
        ${INDENT}Use <font color="green"><strong>"!move done"</strong></font> or
        <font color="green"><strong>"!move 1"</strong></font>
    <h5>Use "!spec" command to add watcher for issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!spec mv_nosak</strong></font>
        or <font color="green"><strong>!spec Носак</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' was added in watchers for the issue<br><br>
    <h5>Use "!prio" command to changed priority issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!prio</strong></font><br>
        ${INDENT}you will see a list:<br>
        ${INDENT}${INDENT}1) Блокирующий<br>
        ${INDENT}${INDENT}2) Критический<br>
        ${INDENT}${INDENT}3) Highest<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}${INDENT}7) Lowest<br>
        ${INDENT}Use <font color="green"><strong>"!prio Lowest"</strong></font> or
        <font color="green"><strong>"!prio 7"</strong></font>
    <h5>Use "!op" command to give moderator rights (admins only)<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!op mv_nosak</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' will become the moderator of the room<br><br>
    <h5>Use "!invite" command to invite you in room (admins only)<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!invite BBCOM-101</strong></font>
        or <font color="green"><strong>!invite #BBCOM-101:messenger.domain</strong></font><br>
        ${INDENT}Bot invite you in room for issue <font color="green">BBCOM-101</font><br><br>
    If you have administrator status, you can invite the bot into the room and he will not be denied:)
    <h5>Use "!ignore" command to add project task-types to ignore list. After that hooks form jira will be ignored.<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!ignore</strong></font>
        ${INDENT}you will see a message:<br>
        ${INDENT}Current ignore-settings for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}3) - Bug<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands add or del types, for example<br>
        ${INDENT}!ignore add Error<br>
        ${INDENT}!ignore del Error<br>
    <h5>Use "!create" command to create new issue in Jira and create links with current issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!create</strong></font><br>
        ${INDENT}you will see a message:<br>
        ${INDENT}Types of task for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}3) - Bug<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands with taskTypes and new name for issue<br>
        ${INDENT}<font color="green"><strong>!create</strong></font> Task My new task<br>
        ${INDENT}New link, this task relates to "New-Jira-key" "My new task"
    <h5>Use "!autoignore" command to add or del matrixUser to any room in this project and this task-type<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!autoignore</strong></font><br>
        ${INDENT}you will see a message:<br>
        ${INDENT}Current ignore-settings for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}@user1:matrix.server.com
        ${INDENT}${INDENT}@user2:matrix.server.com
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}@user3:matrix.server.com
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands add or del types, for example<br>
        ${INDENT}${INDENT}!autoinvite add Error ii_ivanov
        ${INDENT}${INDENT}!autoinvite del Error ii_ivanov
    `;
