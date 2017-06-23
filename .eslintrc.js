module.exports = {
    env: {
        node: true,
        es6: true,
    },
    extends: 'airbnb-base',
    rules: {
        'semi': ['error', 'never'],
        'indent': ['error', 4],
        'spaced-comment': 0,
        'no-underscore-dangle': 0,
        'comma-dangle': [
            'error',
            {
                'arrays': 'always-multiline',
                'objects': 'always-multiline',
                'imports': 'always-multiline',
                'exports': 'always-multiline',
                'functions': 'never',
            },
        ],
        'arrow-parens': [2, 'as-needed', { 'requireForBlockBody': true }],
        'quote-props': 0,
    },
}
