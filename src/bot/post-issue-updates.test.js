/* eslint-disable no-undef, no-console */
const {toStrings, composeText} = require('./post-issue-updates').forTests;

test('hook\'s changelog items to strings', () => {
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
    expect(result).toEqual(value);
});

test('composing html for issue-updated message', () => {
    const result = composeText({
        author: 'Username',
        fields: ['description'],
        formattedValues: {description: '<p>new description</p>'},
    });
    const expected = 'Username changed issue<br>description: <p>new description</p>';
    expect(result).toEqual(expected);
});
