import Logger from 'log4js';
import { BaseService } from "../Interface/ServiceManagerInterface.js";
import { sequelize } from "../DataBase/index.js";
import UsersGif, { UsersGifInstance } from "../DataBase/Models/UsersGif.js";

const logger = Logger.getLogger('db');

class DataBaseService extends BaseService {
    public async Init(): Promise<void> {
        await sequelize.authenticate();
        await sequelize.sync();
        logger.info('Connected to database');
    }

    public async Destroy(): Promise<void> {
        await sequelize.close();
    }

    public async GifSet(userId: string, guildId: string, gif: string): Promise<string> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (userGif) {
            return 'User already has a gif on this server!';
        }

        await UsersGif.create({
            userId: userId,
            guildId: guildId,
            gif: gif,
        });

        return 'Successfully set gif to user!';
    }

    public async GifUpdate(userId: string, guildId: string, gif: string): Promise<string> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (!userGif) {
            return 'Set a gif to user first!';
        }

        await userGif.update({
            gif: gif,
        });

        return 'Successfully set a new gif to user!';
    }

    public async GifRemove(userId: string, guildId: string): Promise<string> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (!userGif) {
            return 'User does not have a gif on this server!';
        }

        await userGif.destroy();

        return 'Successfully unset a gif from user!';
    }

    public async GifGetOne(userId: string, guildId: string): Promise<UsersGifInstance | undefined> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        return userGif;
    }

    public async GifGet(guildId: string): Promise<UsersGifInstance[]> {
        const usersGifs = await UsersGif.findAll({
            where: { guildId: guildId },
        });

        return usersGifs;
    }
}

export default DataBaseService;
