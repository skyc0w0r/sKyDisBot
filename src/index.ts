import { REST } from '@discordjs/rest';
import DSTypes from 'discord-api-types/v9';
import { ChannelType, Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { writeFileSync } from 'fs';
import Logger from 'log4js';
import proccess from 'process';
import config from './config.js';
import human from './human.js';
import AudioConverter from './Service/AudioConverter.js';
import AudioManagerService from './Service/AudioManagerService.js';
import CommandParserService from './Service/CommandParserService.js';
import GreetingsService from './Service/GreetingsService.js';
import { GlobalServiceManager } from './Service/ServiceManager.js';
import WebLoader from './Service/WebLoader.js';
import UtilService from './Service/UtilService.js';
import YandexService from './Service/YandexService.js';
import YouTubeService from './Service/YouTubeService.js';
import DiscordEventerService from './Service/DiscordEventerService.js';
import DataBaseService from './Service/DataBaseService.js';

async function main() {
    config.check();
    Logger.configure(config.get().LOG_CONFIG);

    const logger = Logger.getLogger('main');

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
        ],
    });

    const cp = new CommandParserService({
        prefix: config.get().COMMAND_PREFIX,
    });

    GlobalServiceManager()
        .AddService(CommandParserService, cp)
        .AddService(DataBaseService, new DataBaseService())
        .AddService(YouTubeService, new YouTubeService(config.get().YT_DATA_TOKEN))
        .AddService(WebLoader, new WebLoader(config.get().WEB_USER_AGENT))
        .AddService(AudioConverter, new AudioConverter())
        .AddService(AudioManagerService, new AudioManagerService())
        .AddService(UtilService, new UtilService())
        .AddService(YandexService, new YandexService(config.get().YANDEX_MUSIC_TOKEN))
        .AddService(GreetingsService, new GreetingsService())
        .AddService(DiscordEventerService, new DiscordEventerService(client));

    GlobalServiceManager().Init();

    cp.RegisterCommand('help', async (c) => {
        await c.reply(cp.GetHelpMessage());
    }, {description: 'Display help message'});
    cp.RegisterCommand('unmute', async (c) => {
      if (!c.Guild.members.me.voice.channel) {
        await c.reply({content: 'Summon me first!'});
        return;
      }
      await c.Guild.members.me.voice.setMute(false);
      await c.reply({content: 'Unmuted!'});
    });

    const dsrest = new REST({
        version: '9',
    }).setToken(config.get().DIS_TOKEN);
    if (process.env.COMMANDS_GLOBAL?.toLowerCase() === 'set') {
        try {
            logger.info('Updating global commands');
            await dsrest.put(
                DSTypes.Routes.applicationCommands(config.get().BOT_CLIENT_ID),
                {body : cp.GetDiscordCommandsData() },
            );
            logger.info('Global commands updated');
        } catch (e) {
            logger.fatal('Failed to update global commands', e);
            return;
        }
    } else if (process.env.COMMANDS_GLOBAL?.toLowerCase() === 'unset') {
        try {
            logger.info('Removing global commands');
            await dsrest.put(
                DSTypes.Routes.applicationCommands(config.get().BOT_CLIENT_ID),
                {body : [] },
            );
            logger.info('Global commands removed');
        } catch (e) {
            logger.fatal('Failed to remove global commands', e);
            return;
        }
    }

    client.on(Events.ClientReady, async () => {
        logger.info('Discord client ready');
        if (process.env.COMMANDS_LOCAL?.toLocaleLowerCase() === 'set') {
            logger.info('Updating guild commands');
            await client.guilds.fetch();
            let targets = client.guilds.cache;
            if (config.get().TEST_GUILD_ID) {
                targets = targets.filter(c => c.id === config.get().TEST_GUILD_ID);
            }
            for (const g of targets) {
                await g[1].commands.set(cp.GetDiscordCommandsData());
            }
            logger.info('Guild commands set');
        } else if (process.env.COMMANDS_LOCAL?.toLocaleLowerCase() === 'unset') {
            logger.info('Removing guild commands');
            await client.guilds.fetch();
            let targets = client.guilds.cache;
            if (config.get().TEST_GUILD_ID) {
                targets = targets.filter(c => c.id === config.get().TEST_GUILD_ID);
            }
            for (const g of targets) {
                const cmds = await g[1].commands.fetch();
                for (const c of cmds) {
                    await g[1].commands.delete(c[1]);
                }
            }
            logger.info('Guild commands removed');
        }
    });

    client.on(Events.InteractionCreate, async (inter) => {
        await cp.Dispatch(inter);
    });

    client.on(Events.MessageCreate, async (msg) => {
        await cp.Dispatch(msg);
    });

    await client.login(config.get().DIS_TOKEN);

    const bye: NodeJS.SignalsListener = async (signal) => {
        logger.info(`Got ${signal} signal, shutting down`);
        await GlobalServiceManager().Destroy();
        client.destroy();

        logger.info('Bye...');
        await new Promise<void>((resolve) => {
            Logger.shutdown((e) => {
                if (e) {
                    console.log('Logger shutdown failed', e);
                }
                resolve();
            });
        });

        // wait for anything to close/shutdown within 5 seconds
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 5e3));
        // clear the rest
        process.exit(0);
    };
    proccess.on('SIGINT', bye);
    proccess.on('SIGTERM', bye);
}

main().catch((e: Error) => {
    console.error('Fatal error', e);
    writeFileSync(`crash_${human.dateTime(new Date())}.txt`, `Name: ${e.name}\nMessage: ${e.message}\nStack?: ${e.stack}`, {encoding: 'utf-8'});
});
