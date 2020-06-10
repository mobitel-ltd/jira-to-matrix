import Polyglot from 'node-polyglot';
import { config } from '../config';
import * as en from './en';
import * as ru from './ru';

const lang: { dict: Record<string, string>; tValues?: Function } = config.lang === 'en' ? en : ru;

const polyglot = new Polyglot({
    phrases: lang.dict,
    locale: config.lang,
});

export const translate = (key: string, values?: object, ...args) => {
    const newValues = lang.tValues ? lang.tValues(values, ...args) : values;

    return polyglot.t(key, newValues);
};
