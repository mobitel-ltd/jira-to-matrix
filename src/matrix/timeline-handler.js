const fetchPostJSON = require('../utils').fetchPostJSON;
const fetchJSON = require('../utils').fetchJSON;

module.exports = async function(event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message" || toStartOfTimeline) {
        return;
    }

    const command = await eventFromMatrix(event, room);
    console.log(command);
}

const eventFromMatrix = async (event, room) => {
    const body = event.getContent().body;
    const op = body.match(/!\w*\b/g);

    if (!op) {
        return;
    }

    switch (op[0]) {
        case '!comment':
            const message = body.split(/!comment/i).join(' ');
            let sender = event.getSender();
            sender = sender.substring(1, sender.length - 21);
            let roomName = room.getCanonicalAlias();
            roomName = roomName.substring(1, roomName.length - 21);
    
            let jiraR = await fetchPostJSON(
                `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/comment`,
                'Basic amlyYV90ZXN0X2JvdDp4TDFCSTNDaFcyZGI3Tg==',
                schema(sender, message)
            );
            return 'comment to jira';
        case '!move':
            return 'move issue';
        default:
            return;
    }
}

const schema = (sender, message) => {
    const post = `${sender} закомментил:\n${message}`
    return JSON.stringify({
        "body": post
    });
}

// const schemaMove = () => {
//     return JSON.stringify("aa_makarov");
// }
