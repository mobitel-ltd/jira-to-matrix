/* eslint no-empty-function: ["error", { "allow": ["arrowFunctions"] }] */
const Ramda = require('ramda');
const {createEventAdapter: defaultEventApi} = require('@slack/events-api');
const {WebClient} = require('@slack/client');
const htmlToText = require('html-to-text').fromString;

// const tets = new WebClient();
// tets.conversations.invite()
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
     * @param  {string} infoMessage info message body
     * @param  {string} textBody markdown message body
     */
    async sendHtmlMessage(channel, infoMessage, textBody) {
        try {
            const text = htmlToText(textBody);
            await this.client.chat.postMessage({token: this.token, channel, text});
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
     * Set topic to channel
     * @param  {string} channel channel id
     * @param  {string} topic new topic
     * @returns {Boolean} request result
     */
    async setRoomTopic(channel, topic) {
        try {
            const res = await this.client.conversations.setTopic({token: this.token, channel, topic});

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel topic', err].join('\n');
        }
    }

    /**
     * Set purpose to channel
     * @param  {string} channel channel id
     * @param  {string} purpose new topic
     * @returns {Boolean} request result
     */
    async setPurpose(channel, purpose) {
        try {
            const res = await this.client.conversations.setPurpose({token: this.token, channel, purpose});

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel purpose', err].join('\n');
        }
    }

    /**
     * Create Slack channel
     * @param  {Object} options create channel options
     * @param  {String} options.name name for channel, less than 21 sign, lowerCase, no space
     * @param  {String} options.topic slack channel topic
     * @param  {Array} options.invite user emails to invite
     * @param  {Array} options.summary issue summary
     * @returns {string} Slack channel id
     */
    async createRoom({name, topic, invite, purpose}) {
        try {
            const ids = await Promise.all(invite.map(this._getUserIdByEmail.bind(this)));
            const options = {
                'token': this.token,
                'is_private': true,
                'name': name.toLowerCase(),
                'user_ids': ids.filter(Boolean),
            };
            const {channel} = await this.client.conversations.create(options);
            const roomId = channel.id;
            await this.setRoomTopic(roomId, topic);
            await this.setPurpose(roomId, purpose);

            return roomId;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while creating room', err].join('\n');
        }
    }

    /**
    * Get slack channel id by name
    * @param  {string} name slack channel name
    * @returns {string|undefined} channel id if exists
    */
    async getRoomId(name) {
        const searchingName = name.toLowerCase();
        try {
            // ? Limit of channels is only 1000 now
            const {channels} = await this.slackSdkClient.users.conversations({token: this.token, limit: 1000, types: 'private_channel'});
            const channel = channels.find(item => item.name === searchingName);

            const roomId = Ramda.path(['id'], channel);
            if (!roomId) {
                throw `No channel for ${searchingName}`;
            }

            return roomId;
        } catch (err) {
            throw [`Error getting channel id by name "${searchingName}" from Slack`, err].join('\n');
        }
    }

    /**
     * Invite user to slack channel
     * @param  {string} channel slack channel id
     * @param  {string} email slack user email
     */
    async invite(channel, email) {
        try {
            const userId = await this._getUserIdByEmail(email);
            const response = await this.client.conversations.invite({token: this.token, channel, users: userId});

            return response.ok;
        } catch (err) {
            this.logger.error(err);
            throw [`Error while inviting user ${email} to a channel ${channel}`, err].join('\n');
        }
    }

    /**
     * get channel members
     * @param {String} name channel name
     * @returns {Array} channel members
     */
    async getRoomMembers(name) {
        try {
            const channel = await this.getRoomId(name);
            const {members} = await this.client.conversations.members({token: this.token, channel});

            return members;
        } catch (err) {
            throw [`Error while getting slack members from channel ${name}`, err].join('\n');
        }
    }

    /**
     * Empty method to avoid error with create alias in matrix
     *  @returns {Boolean} always true
     */
    createAlias() {
        return true;
    }

    /**
     * Set new name to the channel
     * @param  {string} channel channel id
     * @param  {string} name new topic
     * @returns {Boolean} request result
     */
    async setRoomName(channel, name) {
        try {
            const res = await this.client.conversations.rename({token: this.token, channel, name});

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel topic', err].join('\n');
        }
    }
};
