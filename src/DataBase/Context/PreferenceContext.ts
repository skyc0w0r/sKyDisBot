import Logger from 'log4js';
import ServerPreference from '../Models/ServerPreference.js';

const logger = Logger.getLogger('db_pref');

class PreferenceContext {
    public async Set(guildId: string, key: string, value: string): Promise<void> {
        const pref = await ServerPreference.findOne({
            where: {
                guildId: guildId,
                name: key,
            },
        });

        if (!pref) {
            await ServerPreference.create({
                guildId: guildId,
                name: key,
                value: value,
            });
        } else {
            await pref.update({
                value: value,
            });
        }

        logger.info('Guild', guildId, 'set', key, 'to', value);
    }

    public async Get(guildId: string, key: string): Promise<string | undefined> {
        const pref = await ServerPreference.findOne({
            where: {
                guildId: guildId,
                name: key,
            },
        });

        return pref?.value;
    }
}

export default PreferenceContext;
