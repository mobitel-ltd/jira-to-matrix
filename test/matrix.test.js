const config = require('../src/config/');
const fakeConfig = require('./fixtures/config');
const Matrix = require('../src/matrix');
const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const nock = require('nock');

describe('Matrix api', async function() {
    this.timeout(15000);
    let client;
    const {password, userId, baseUrl} = config.matrix;
    const body = {
        "device": {},
        "global": {
            "content": [
                {
                    "default": true,
                    "pattern": "jira_test_bot",
                    "enabled": true,
                    "rule_id": ".m.rule.contains_user_name",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "default"
                        },
                        {
                            "set_tweak": "highlight"
                        }
                    ]
                }
            ],
            "override": [
                {
                    "default": true,
                    "enabled": false,
                    "conditions": [],
                    "rule_id": ".m.rule.master",
                    "actions": [
                        "dont_notify"
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.notice",
                            "kind": "event_match",
                            "key": "content.msgtype"
                        }
                    ],
                    "rule_id": ".m.rule.suppress_notices",
                    "actions": [
                        "dont_notify"
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.room.member",
                            "kind": "event_match",
                            "key": "type"
                        },
                        {
                            "pattern": "invite",
                            "kind": "event_match",
                            "key": "content.membership"
                        },
                        {
                            "pattern": "@jira_test_bot:matrix.bingo-boom.ru",
                            "kind": "event_match",
                            "key": "state_key"
                        }
                    ],
                    "rule_id": ".m.rule.invite_for_me",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "default"
                        },
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.room.member",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.member_event",
                    "actions": [
                        "dont_notify"
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "kind": "contains_display_name"
                        }
                    ],
                    "rule_id": ".m.rule.contains_display_name",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "default"
                        },
                        {
                            "set_tweak": "highlight"
                        }
                    ]
                }
            ],
            "sender": [],
            "room": [],
            "underride": [
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.call.invite",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.call",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "ring"
                        },
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "kind": "room_member_count",
                            "is": "2"
                        },
                        {
                            "pattern": "m.room.message",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.room_one_to_one",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "default"
                        },
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "kind": "room_member_count",
                            "is": "2"
                        },
                        {
                            "pattern": "m.room.encrypted",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.encrypted_room_one_to_one",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "sound",
                            "value": "default"
                        },
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.room.message",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.message",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                },
                {
                    "default": true,
                    "enabled": true,
                    "conditions": [
                        {
                            "pattern": "m.room.encrypted",
                            "kind": "event_match",
                            "key": "type"
                        }
                    ],
                    "rule_id": ".m.rule.encrypted",
                    "actions": [
                        "notify",
                        {
                            "set_tweak": "highlight",
                            "value": false
                        }
                    ]
                }
            ]
        }
    }

    before(() => {
        nock(baseUrl)
            .get('/_matrix/client/r0/sync/')
            .query({
                filter: 1,
                timeout: 0,
                _cacheBuster: 1513953856385,
                access_token: 'accessToken',
            })
            .reply(200, {})

            .get('/_matrix/client/r0/pushrules/')
            .query({access_token: 'accessToken'})
            .reply(200, body)

            .post('/_matrix/client/r0/login', {
                type: "m.login.password",
                user: userId,
                password,
            })
            .reply(200, {access_token: 'accessToken'})

            .post('/_matrix/client/r0/user/%40jira_test_bot%3Amatrix.bingo-boom.ru/filter', {
                room: {
                    timeline: {
                        limit: 8,
                    },
                },
            })
            .query({access_token: 'accessToken'})
            .reply(200, {access_token: 'accessToken'});  
    });

    it('test matrix true config connect from sdk-client', async () => {
        client = await Matrix.connect();
        logger.debug('client.getSyncState', Matrix.isConnected());
        logger.debug('client', client);
        assert.ok(Matrix.isConnected());
        Matrix.disconnect();
        // logger.debug('client.getSyncState', Matrix.getSyncState());
        assert.ifError(Matrix.isConnected());
    });
    
    // it('test matrix true config connect from sdk-client', async () => {
    //     const {connect, disconnect} = await init(config.matrix);
    //     client = await connect();
    //     logger.debug('client.getSyncState', client.getSyncState());
    //     assert.ok(client.clientRunning);
    //     await disconnect();
    //     logger.debug('client.getSyncState', client.getSyncState());
    //     assert.ifError(client.clientRunning);
    // });

    // it('test matrix fake config connect from sdk-client', async () => {
    //     try {
    //         const {connect} = await init(fakeConfig.matrix);
    //     } catch (err) {
    //         const funcErr = () => {
    //             throw err
    //         };
    //         assert.throws(funcErr, /No baseUrl/);
    //     }
    // });
    
    // it('test matrix connect with fake password from sdk-client', async () => {
    //     try {
    //         const {matrix} = config;
    //         const matrixWithFakePassword = {...matrix, password: 'fake'};
    //         const connect = await init(matrixWithFakePassword);
    //     } catch (err) {
    //         const funcErr = () => {
    //             throw err
    //         };
    //         assert.throws(funcErr, /Invalid password/);
    //     }
    // });

    // it('test matrixApi', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     // const initconf = await init(config.matrix);
    //     // logger.debug('connect', connect);
    //     // logger.debug('init', initconf);
    //     const expected = ['createRoom', 'getRoomId', 'getRoomByAlias', 'getRoomMembers', 'invite', 'sendHtmlMessage', 'createAlias', 'setRoomName', 'setRoomTopic'];
    //     const api = await connect();
    //     const result = Object.values(api).map(func => func.name)
    //     assert.ok(expected, result);
    //     (await disconnect())();
    //     assert.ifError(client.clientRunning);
    //     logger.debug('helpers', helpers);
    // });

    
    // await after(async () => {
    //     if (client) {
    //         await client.stopClient();
    //     }
    // });

    // after(() => process.exit(1));
    
});