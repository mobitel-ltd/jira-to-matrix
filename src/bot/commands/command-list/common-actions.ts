import minimist from 'minimist';
import * as R from 'ramda';
import { getLogger } from '../../../modules/log';
import { MessengerApi } from '../../../types';

const logger = getLogger(module);

export const EXPECTED_POWER = 100;
const NO_POWER = 'No power';
const ADMINS_EXISTS = 'admins exists';
const ALL_KICKED = 'all deleted';
const FORBIDDEN_KICK_ADMIN = 'forbidden admin kick';
const ERROR_KICK = 'error kick';
const NOT_EXIST = 'user is not in room';
const FORBIDDEN_SELF_KICK = 'self kick';

export const kickStates = {
    NO_POWER,
    ADMINS_EXISTS,
    ALL_KICKED,
    FORBIDDEN_KICK_ADMIN,
    ERROR_KICK,
    NOT_EXIST,
    FORBIDDEN_SELF_KICK,
};

export const getGroupedUsers = (
    members: { userId: string; powerLevel: number }[],
    botId: string,
): { simpleUsers: string[]; admins: string[]; bot: string[] } => {
    const getGroup = (user: { userId: string; powerLevel: number }) => {
        if (user.powerLevel < EXPECTED_POWER) {
            return 'simpleUsers';
        }

        return user.userId.includes(botId) ? 'bot' : 'admins';
    };

    const res: { admins?: string[]; simpleUsers?: string[]; bot?: string[] } = R.pipe(
        R.groupBy(getGroup),
        R.map(R.map(R.path(['userId']))) as any,
    )(members) as { admins?: string[]; simpleUsers?: string[]; bot?: string[] };

    return {
        admins: res.admins || [],
        simpleUsers: res.simpleUsers || [],
        bot: res.bot || [],
    };
};

export const hasPowerToKick = (botId, members, expectedPower) => {
    const botData = members.find(user => user.userId.includes(botId));

    return botData && botData.powerLevel === expectedPower;
};

export const kickUsers = async (
    chatApi: MessengerApi,
    roomId: string,
    users: string[],
): Promise<{ userId: string; isKicked: boolean }[]> => {
    const result = await Promise.all(
        users.map(async (userId: string) => {
            const res = await chatApi.kickUserByRoom({ roomId, userId });

            return { userId, isKicked: Boolean(res) };
        }),
    );

    const viewRes = result.map(({ userId, isKicked }) => `${userId} ---- ${isKicked}`).join('\n');
    logger.debug(`Result of kicking users from room with id "${roomId}"\n${viewRes}`);

    return result;
};

export const kick = async (chatApi: MessengerApi, { id, members }, userToKick?: string) => {
    if (!hasPowerToKick(chatApi.getMyId(), members, EXPECTED_POWER)) {
        logger.debug(`No power for kick in room with id ${id}`);

        return NO_POWER;
    }

    const groupedData = getGroupedUsers(members, chatApi.getMyId());
    if (userToKick) {
        if (groupedData.admins.includes(userToKick)) {
            return kickStates.FORBIDDEN_KICK_ADMIN;
        }
        if (groupedData.bot.includes(userToKick)) {
            return kickStates.FORBIDDEN_SELF_KICK;
        }
        if (!groupedData.simpleUsers.includes(userToKick)) {
            return kickStates.NOT_EXIST;
        }

        const [res] = await kickUsers(chatApi, id, [userToKick]);

        return res.isKicked ? ALL_KICKED : ERROR_KICK;
    }

    await kickUsers(chatApi, id, groupedData.simpleUsers);

    if (groupedData.admins.length) {
        logger.debug(`Room have admins which bot cannot kick:\n ${groupedData.admins.join('\n')}`);

        return ADMINS_EXISTS;
    }

    return ALL_KICKED;
};

export const parseBodyText = (
    bodyText = '',
    {
        first,
        ...usingParam
    }: { first?: boolean } & { boolean?: string[]; string?: string[]; alias: Record<string, string> },
) => {
    const unknown: string[] = [];
    const arrFromBody = bodyText
        .split('\n')
        .join(' ')
        .split(' ')
        .filter(Boolean)
        .map(el => el.trim());

    const rest = first ? arrFromBody.slice(1) : arrFromBody;
    const param = first ? arrFromBody[0] : null;

    const res = minimist(rest, {
        ...usingParam,
        unknown: el => {
            unknown.push(el);

            return true;
        },
    });
    const boolParams = usingParam.boolean || [];
    const stringParams = usingParam.string || [];

    const get = val => res[val];
    const has = val => (stringParams.includes(val) ? Object.keys(res).includes(val) : Boolean(get(val)));
    const hasUnknown = () => Boolean(unknown.length);
    const hasManyOptions = () => {
        const existBoolean = boolParams.filter(has);
        const existString = stringParams.filter(has);
        const allExists = [...existBoolean, ...existString].filter(Boolean);

        return allExists.length > 1;
    };

    return {
        param,
        has,
        get,
        unknown: R.uniq(unknown),
        hasUnknown,
        hasManyOptions,
    };
};
