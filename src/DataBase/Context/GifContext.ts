import UsersGif, { UsersGifInstance } from "../Models/UsersGif.js";

class GifContext {
    public async Set(userId: string, guildId: string, gif: string): Promise<string> {
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

    public async Update(userId: string, guildId: string, gif: string): Promise<string> {
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

    public async Remove(userId: string, guildId: string): Promise<string> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (!userGif) {
            return 'User does not have a gif on this server!';
        }

        await userGif.destroy();

        return 'Successfully unset a gif from user!';
    }

    public async GetOne(userId: string, guildId: string): Promise<UsersGifInstance | null> {
        const userGif = await UsersGif.findOne({
            where: { userId: userId, guildId: guildId },
        });

        return userGif;
    }

    public async Get(guildId: string): Promise<UsersGifInstance[]> {
        const usersGifs = await UsersGif.findAll({
            where: { guildId: guildId },
        });

        return usersGifs;
    }
}

export default GifContext;
