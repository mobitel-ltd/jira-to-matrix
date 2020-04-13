const faker = require('faker');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const { getGroupedUsers, parseBodyText } = require('../../src/bot/commands/command-list/common-actions');

describe('Common test', () => {
    describe('groupedusers', () => {
        it('groupUsers test', () => {
            const admins = Array.from({ length: 5 }, () => ({
                userId: faker.random.alphaNumeric(10),
                powerLevel: 100,
            }));
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

    describe('parsebody', () => {
        const optionOne = {
            name: 'one',
            alias: 'o',
        };
        const optionTwo = {
            name: 'two',
            alias: 't',
        };
        const schema = {
            alias: {
                [optionOne.name]: optionOne.alias,
                [optionTwo.name]: optionTwo.alias,
            },
            string: [optionOne.name, optionTwo.name],
            first: true,
        };
        const value = 3;
        const param = faker.random.words(1).split(' ')[0];

        it('Expect return no unknown and option value exists', () => {
            const text = [param, `-${optionOne.alias}`, value].join('    ');
            const res = parseBodyText(text, schema);

            expect(res.param).to.eq(param);
            expect(res.hasUnknown()).to.be.false;
            expect(res.has(optionOne.name)).to.be.true;
            expect(res.get(optionOne.name)).to.eq(String(value));
        });

        it('Expect return false if extra value exists', () => {
            const unknown = `-${optionOne.alias}opopop`;
            const text = [param, unknown, value].join('\n');
            const res = parseBodyText(text, schema);

            expect(res.param).to.eq(param);
            expect(res.hasUnknown()).to.be.true;
            expect(res.unknown).to.deep.eq([unknown]);
        });
    });
});
