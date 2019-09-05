const states = {
    // only jira connected, start of app
    init: 'empty',
    // all is connected
    connected: 'connected',
    // start connection
    startConnection: 'startConnection',
    // got hook from jira
    hookResponsed: 'hookResponsed',
    // start queue handling
    startHandling: 'startHandling',
    // queue handling
    handlingInProgress: 'handlingInProgress',
    // all data is handled and app is waiting for hooks
    ready: 'ready',
};

// const notReadyStates = [states.init, states.handlingInProgress, states.waiting];
// const readyStates = [states.connected, states.ready];

module.exports = {
    states,
};
