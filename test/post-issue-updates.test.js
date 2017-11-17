/* eslint-disable no-undef, no-console */
const {toStrings, composeText} = require('../src/bot/post-issue-updates').forTests;
const assert = require('assert');

it('hook\'s changelog items to strings', () => {
    const items = [
        {
            field: 'assignee',
            toString: 'someone',
        },
        {
            field: 'description',
            toString: 'new descr',
        },
    ];
    const result = toStrings(items);
    const value = {
        assignee: 'someone',
        description: 'new descr',
    };
    assert.deepEqual(result, value);
});

it('composing html for issue-updated message', () => {
    const result = composeText({
        author: 'Username',
        fields: ['description'],
        formattedValues: {description: '<p>new description</p>'},
    });
    const expected = 'Username изменил(а) задачу<br>description: <p>new description</p>';
    assert.deepEqual(result, expected);
});
