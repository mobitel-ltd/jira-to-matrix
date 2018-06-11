const {getRoomsLastUpdate, kickAllMembers} = require('../../src/matrix/timeline-handler/commands/helper');
const {expect} = require('chai');
const rooms = require('../fixtures/rooms');

// describe('Test kick', () => {
//     it('test getRoomsLastUpdate', () => {
//         const result = getRoomsLastUpdate(rooms);
//         expect(result).to.be;
//     });
// });
