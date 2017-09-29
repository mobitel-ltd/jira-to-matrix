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

        let jiraR = await fetchPostJSON(
                `https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-1011/comment`,
                "Basic amlyYV90ZXN0X2JvdDp4TDFCSTNDaFcyZGI3Tg==",
                message,
                sender,
            );
    }
}