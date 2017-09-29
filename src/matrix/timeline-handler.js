const fetchPostJSON = require('../utils').fetchPostJSON;

module.exports = async function(event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
        return; // don't print paginated results
    }
    if (event.getType() !== "m.room.message") {
        return; // only print messages
    }
    const body = event.getContent().body;

    if (body.match(/!comment/ig)) {
        const message = body.split(/!comment/ig).join(' ');
        let sender = event.getSender();
        sender = sender.substring(1, sender.length - 21);
        let roomName = room.getCanonicalAlias();
        roomName = roomName.substring(1, roomName.length - 21);

        let jiraR = await fetchPostJSON(
            `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/comment`,
            'Basic amlyYV90ZXN0X2JvdDp4TDFCSTNDaFcyZGI3Tg==',
            message,
            sender,
        );
    }
}