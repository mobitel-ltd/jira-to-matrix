const {domain} = require('../../../config').matrix;

module.exports = async ({room, self}) => {
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';

    const post = `
    <h5>Use "!comment" command to comment in jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!comment some text</strong></font><br>
        ${indent}text "<font color="green">some text</font>" will be shown in jira comments<br>
    <h5>Use "!assign" command to assign jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!assign mv_nosak</strong></font>
        or <font color="green"><strong>!assign Носак</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' will become assignee for the issue<br><br>
        ${indent}<font color="green"><strong>!assign</strong></font><br>
        ${indent}you will become assignee for the issue
    <h5>Use "!move" command to view list of available transitions<br>
    example:</h5>
        ${indent}<font color="green"><strong>!move</strong></font><br>
        ${indent}you will see a list:<br>
        ${indent}${indent}1) Done<br>
        ${indent}${indent}2) On hold<br>
        ${indent}Use <font color="green"><strong>"!move done"</strong></font> or
        <font color="green"><strong>"!move 1"</strong></font>
    <h5>Use "!spec" command to add watcher for issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!spec mv_nosak</strong></font>
        or <font color="green"><strong>!spec Носак</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' was added in watchers for the issue<br><br>
    <h5>Use "!prio" command to changed priority issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!prio</strong></font><br>
        ${indent}you will see a list:<br>
        ${indent}${indent}1) Блокирующий<br>
        ${indent}${indent}2) Критический<br>
        ${indent}${indent}3) Highest<br>
        ${indent}${indent}...<br>
        ${indent}${indent}7) Lowest<br>
        ${indent}Use <font color="green"><strong>"!prio Lowest"</strong></font> or
        <font color="green"><strong>"!prio 7"</strong></font>
    <h5>Use "!op" command to give moderator rights (admins only)<br>
    example:</h5>
        ${indent}<font color="green"><strong>!op mv_nosak</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' will become the moderator of the room<br><br>
    <h5>Use "!invite" command to invite you in room (admins only)<br>
    example:</h5>
        ${indent}<font color="green"><strong>!invite BBCOM-101</strong></font>
        or <font color="green"><strong>!invite #BBCOM-101:${domain}</strong></font><br>
        ${indent}Bot invite you in room for issue <font color="green">BBCOM-101</font><br><br>
    If you have administrator status, you can invite the bot into the room and he will not be denied:)
    `;

    await self.sendHtmlMessage(room.roomId, 'Help info', post);
};
