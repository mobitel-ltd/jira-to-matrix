const {fieldNames, itemsToString, composeText} = require('../../src/bot/post-issue-updates').forTests;
const assert = require('assert');

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

it('hook\'s changelog items to strings', () => {
    const result = itemsToString(items);
    const value = {
        assignee: 'someone',
        description: 'new descr',
    };
    assert.deepEqual(result, value);
});

it('getting hook\'s changelog items fields', () => {
    const result = fieldNames(items);
    const value = [ 'assignee', 'description' ];
    assert.deepEqual(result, value);
});

it('composing html for issue-updated message', () => {
    const result = composeText({
        author: 'Автор',
        fields: ['description'],
        formattedValues: {description: '<p>new description</p>'},
    });
    const expected = 'Автор изменил(а) задачу<br>description: <p>new description</p>';
    assert.deepEqual(result, expected);
});
