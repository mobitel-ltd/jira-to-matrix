import Polyglot from 'node-polyglot';
import { config } from '../config';

const lang = await import(`./${config.lang}`);

const polyglot = new Polyglot({
    phrases: lang.dict,
    locale: config.lang,
});

export const translate = (key: string, values?: object, ...args) => {
    const newValues = lang.tValues ? lang.tValues(values, ...args) : values;

    return polyglot.t(key, newValues);
};
