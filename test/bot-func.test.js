const {getNewStatus} = require('../src/bot/helper.js');
const assert = require('assert');
const body = require('./fixtures/comment-create-2.json');
const logger = require('debug')('bot-func');
const Ramda = require('ramda');

// const func = Ramda.pathOr([], ['changelog', 'items']);
// const func2 = Ramda.propEq('field', 'status');
// const func3 = Ramda.filter(func2)
const obj = {
  changelog: {
    items: {
      correct: {
        field: 'status',
      },
      notCorrect: {
        field: 'status',
      },
    }
  },
};

describe('bot func', function() {
  it('test getNewStatus', () => {
    // const result1 = func(obj);
    // logger('result1', result1);
    // logger('true', func2(result1));
    // const result2 = func3(result1);
    const result = getNewStatus(obj);
    logger('result', result);
    // logger('result', result2);
    assert.deepEqual(result, []);
  });
});
