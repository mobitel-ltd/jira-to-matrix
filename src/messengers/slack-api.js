const {createEventAdapter: defaultAdapter} = require('@slack/events-api');
const slackSdk = require('@slack/client');

module.exports = class SlackApi {
    /**
     * slack api for bot
     * @param  {Object} {config config object
     * @param  {Object} sdk slack sdk https://github.com/slackapi/node-slack-sdk
     * @param  {function} timelineHandler handler for timeline events
    //  * @param  {Boolean} loggerOn turn on logger, by default is true
     * @param  {function|undefined} logger custom logger
     */
    constructor({config, sdk = slackSdk, timelineHandler, logger, createEventAdapter = defaultAdapter}) {
        this.timelineHandler = timelineHandler;
        this.config = config;
        this.sdk = sdk;
        this.web = new sdk.WebClient(config.password);
        this.logger = logger;
        this.slackEvents = createEventAdapter(config.eventPassword);
    }


    /**
     * Handler to add timeline handler to watch events in a room
     * @returns {Object} slack client
     */
    async _startEventListener() {
        if (!this.client) {
            this.logger.error('slackclient is undefined');
            return;
        }
        const port = this.config.eventPort;

        // Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
        this.slackEvents.on('message', event => {
            const msg = `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`;
            this.logger.debug(msg);
        });

        // Handle errors (see `errorCodes` export)
        this.slackEvents.on('error', this.logger.error);

        // Start a basic HTTP server
        await this.slackEvents.start(port);
        this.logger.debug(`Slack event server listening on port ${port}`);

        return this.client;
    }

    /**
     * @private
     * @returns {Promise} connected slackClient
     */
    async _startClient() {
        try {
            await this.web.auth.test();
            this.logger.info('Slack client started!');
            this.client = this.web;

            return this.client;
        } catch (err) {
            throw ['Error in slack connection', err].join('\n');
        }
    }

    /**
     * @returns {Object} connected slackClient with api for Jira
     */
    async connect() {
        try {
            await this._startClient();
            return this._startEventListener();
        } catch (err) {
            throw ['Error in slack connection', err].join('\n');
        }
    }

    /**
     * @returns {Boolean} connect status
     */
    isConnected() {
        if (this.slackEvents) {
            return true;
        }
        this.logger.error('slack client is not initialized');

        return false;
    }

    /**
     * @returns {void} disconnected slackClient
     */
    disconnect() {
        if (this.isConnected()) {
            this.slackEvents.stop();
            this.logger.info('Disconnected from Slack');
        }
    }
};
