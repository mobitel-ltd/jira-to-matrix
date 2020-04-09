const faker = require('faker');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const { getGroupedUsers } = require('../../src/bot/timeline-handler/commands/common-actions');

describe('Common test', () => {
    it('groupUsers test', () => {
        const admins = Array.from({ length: 5 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const simpleUsers = Array.from({ length: 5 }, () => ({
            userId: faker.random.alphaNumeric(10),
            powerLevel: faker.random.number(99),
        }));
        const bot = Array.from({ length: 1 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const data = [...bot, ...admins, ...simpleUsers];

        const expectedData = {
            simpleUsers: simpleUsers.map(user => user.userId),
            bot: bot.map(user => user.userId),
            admins: admins.map(user => user.userId),
        };

        expect(getGroupedUsers(data, bot[0].userId)).deep.eq(expectedData);
    });

    it('groupUsers test return empty array for each group if no such user exists', () => {
        const bot = Array.from({ length: 1 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const data = bot;

        const expectedData = {
            simpleUsers: [],
            bot: bot.map(user => user.userId),
            admins: [],
        };

        expect(getGroupedUsers(data, bot[0].userId)).deep.eq(expectedData);
    });
});
