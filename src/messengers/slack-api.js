/* eslint no-empty-function: ["error", { "allow": ["arrowFunctions"] }] */
const Ramda = require('ramda');
const {createEventAdapter: defaultEventApi} = require('@slack/events-api');
const {WebClient} = require('@slack/client');

// const tets = new WebClient();
// tets
const defaultLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
};

module.exports = class SlackApi {
    /**
     * slack api for bot
     * @param  {Object} options api options
     * @param  {Object} options.config config for slack
     * @param  {Object} options.slackSdkClient slack sdk client, if not exists - instance of WebClient from https://github.com/slackapi/node-slack-sdk
     * @param  {function} options.timelineHandler handler for timeline events
     * @param  {Object} options.logger logger, winstone type, if no logger is set logger is off
     * @param  {Object} options.eventApi slack events api, by default - https://github.com/slackapi/node-slack-events-api
     * @param  {function|undefined} logger custom logger
     */
    constructor({config, slackSdkClient, timelineHandler, logger = defaultLogger, eventApi = defaultEventApi}) {
        this.timelineHandler = timelineHandler;
        this.config = config;
        this.token = config.password;
        this.slackSdkClient = slackSdkClient || new WebClient(this.token);
        this.logger = logger;
        this.slackEvents = eventApi(config.eventPassword);
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

        // Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
        // this.slackEvents.on('message', event => {
        //     this.logger.debug(event);
        //     const msg = `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`;
        //     this.logger.debug(msg);
        // });

        // // Handle errors (see `errorCodes` export)
        // this.slackEvents.on('error', this.logger.error);

        // Start a basic HTTP server
        await this.slackEvents.start(this.config.eventPort);
        this.logger.debug(`Slack event server listening on port ${this.config.eventPort}`);

        return this;
    }

    /**
     * @private
     * @returns {Promise} connected slackClient
     */
    async _startClient() {
        try {
            await this.slackSdkClient.auth.test();
            this.logger.info('Slack client started!');
            this.client = this.slackSdkClient;
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
     * disconnected slackClient
     */
    disconnect() {
        if (this.isConnected()) {
            this.slackEvents.stop();
            this.logger.info('Disconnected from Slack');
        }
    }

    /**
     * Send message to Slack room
     * @param  {string} channel slack room id
     * @param  {string} attachments info message body
     * @param  {string} text markdown message body
     */
    async sendHtmlMessage(channel, attachments, text) {
        try {
            await this.client.chat.postMessage({token: this.token, channel, text, attachments});
        } catch (err) {
            throw ['Error in sendHtmlMessage', err].join('\n');
        }
    }


    /**
     * @param  {string} email user mail
     * @returns {string|undefined} slack user id or undefined
     */
    async _getUserIdByEmail(email) {
        try {
            const userInfo = await this.client.users.lookupByEmail({token: this.token, email});

            return Ramda.path(['user', 'id'], userInfo);
        } catch (error) {
            this.logger.error(`Error getting user for slack by ${email}`, error);
        }
    }

    /**
     * Create Slack channel
     * @param  {Object} options create channel options
     * @param  {String} options.name name for channel, less than 21 sign, lowerCase, no space
     * @param  {String} options.topic slack channel topic
     * @param  {Array} options.invite user emails to invite
     * @returns {string} Slack channel id
     */
    async createRoom({name, topic, invite}) {
        try {
            const ids = await Promise.all(invite.map(this._getUserIdByEmail.bind(this)));
            const {channel} = await this.client.conversations.create({'token': this.token, 'is_private': true, name, 'user_ids': ids.filter(Boolean)});
            const roomId = channel.id;
            await this.client.conversations.setTopic({channel: roomId, topic});

            return roomId;
        } catch (err) {
            throw ['Error while creating room', err].join('\n');
        }
    }

    /**
    * Get slack channel id by name
    * @param  {string} name slack channel name
    * @returns {string|undefined} channel id if exists
    */
    async getRoomId(name) {
        try {
            const {channels} = await this.slackSdkClient.users.conversations({token: this.token, limit: 1000, types: 'private_channel'});
            const channel = channels.find(item => item.name === name.toLowerCase());

            return Ramda.path(['id'], channel);
        } catch (err) {
            this.logger.error(err);
            throw [`Error getting channel id by name "${name}" from Slack`, err].join('\n');
        }
    }
};
