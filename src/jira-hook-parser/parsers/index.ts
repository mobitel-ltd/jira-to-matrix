import * as jiraParser from './jira';

const parsers = {
    jira: jiraParser.getFuncAndBody,
};

export const getParser = (type: 'jira') => parsers[type];
