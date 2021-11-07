import Discord from 'discord.js';
import DSRest from '@discordjs/rest';
import DSTypes from 'discord-api-types/v9';
import Logger from 'log4js';
import proccess from 'process';
import config from './config.js';
import YouTubeService from './Service/YouTubeService.js';
import AudioConverter from './Service/AudioConverter.js';
import AudioManagerService from './Service/AudioManagerService.js';
import { GlobalServiceManager } from './Service/ServiceManager.js';
import CommandParserService from './Service/CommandParserService.js';

async function main() {
    config.check();
    Logger.configure(config.get().LOG_CONFIG);
    const cp = new CommandParserService({
        prefix: config.get().COMMAND_PREFIX,
    });
    GlobalServiceManager()
        .AddService(CommandParserService, cp)
        .AddService(YouTubeService, new YouTubeService(config.get().YT_DATA_TOKEN))
        .AddService(AudioConverter, new AudioConverter())
        .AddService(AudioManagerService, new AudioManagerService());   
    
    GlobalServiceManager().Init();

    cp.RegisterCommand('help', async (c) => {
        await c.reply({ content: 'put help message here' });
    });

    const logger = Logger.getLogger('main');
    const cl = new Discord.Client({
        intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_VOICE_STATES']
    });

    // const dsrest = new DSRest.REST({
    //     version: '9',
    // }).setToken(config.get().DIS_TOKEN);
    // try {
    //     await dsrest.put(
    //         DSTypes.Routes.applicationGuildCommands(config.get().BOT_CLIENT_ID, config.get().TEST_GUILD_ID), {
    //         body: commands
    //     });
    // } catch (e) {
    //     logger.fatal('Failed to registered commands', e);
    //     return;
    // }

    cl.on('ready', async () => {
        logger.info('Discord client ready');

        await cl.guilds.fetch();
        const g = cl.guilds.cache.get(config.get().TEST_GUILD_ID);
        // await g.commands.set(commands);
        await g.commands.set(cp.GetDiscordCommandsData());
        
        logger.info('Commands set');
    });

    cl.on('interactionCreate', async (inter) => {
        await cp.Dispatch(inter);
    });

    cl.on('messageCreate', async (msg) => {
        await cp.Dispatch(msg);
    });
    
    await cl.login(config.get().DIS_TOKEN);
    
    const bye: NodeJS.SignalsListener = async (signal) => {
        logger.info(`Got ${signal} signal, shutting down`);
        await GlobalServiceManager().Destroy();
        cl.destroy();

        logger.info('Bye...');
        await new Promise<void>((resolve) => {
            Logger.shutdown((e) => {
                if (e) {
                    console.log('Logger shutdown failed', e);
                }
                resolve();
            });
        });

        process.exit(0);
    };
    proccess.on('SIGINT', bye);
    proccess.on('SIGTERM', bye);
}

main();
