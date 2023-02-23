import { REST } from '@discordjs/rest';
import DSTypes from 'discord-api-types/v9';
import Discord, { ChannelType, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { writeFileSync } from 'fs';
import Logger from 'log4js';
import proccess from 'process';
import config from './config.js';
import human from './human.js';
import AudioConverter from './Service/AudioConverter.js';
import AudioManagerService from './Service/AudioManagerService.js';
import CommandParserService from './Service/CommandParserService.js';
import DataBaseService, { UsersGif } from './Service/DataBaseService.js';
import { GlobalServiceManager } from './Service/ServiceManager.js';
import WebLoader from './Service/WebLoader.js';
import YouTubeService from './Service/YouTubeService.js';

async function main() {
    config.check();
    Logger.configure(config.get().LOG_CONFIG);
    const cp = new CommandParserService({
        prefix: config.get().COMMAND_PREFIX,
    });
    const db = new DataBaseService();
    // init Data Base SQLite

    GlobalServiceManager()
        .AddService(CommandParserService, cp)
        .AddService(YouTubeService, new YouTubeService(config.get().YT_DATA_TOKEN))
        .AddService(WebLoader, new WebLoader(config.get().WEB_USER_AGENT))
        .AddService(AudioConverter, new AudioConverter())
        .AddService(AudioManagerService, new AudioManagerService())
        .AddService(DataBaseService, db);

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


    const logger = Logger.getLogger('main');
    const cl = new Discord.Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
        ],
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

    cl.on(Events.ClientReady, async () => {
        logger.info('Discord client ready');
        if (process.env.COMMANDS_LOCAL?.toLocaleLowerCase() === 'set') {
            logger.info('Updating guild commands');
            await cl.guilds.fetch();
            let targets = cl.guilds.cache;
            if (config.get().TEST_GUILD_ID) {
                targets = targets.filter(c => c.id === config.get().TEST_GUILD_ID);
            }
            for (const g of targets) {
                await g[1].commands.set(cp.GetDiscordCommandsData());
            }
            logger.info('Guild commands set');
        } else if (process.env.COMMANDS_LOCAL?.toLocaleLowerCase() === 'unset') {
            logger.info('Removing guild commands');
            await cl.guilds.fetch();
            let targets = cl.guilds.cache;
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

    cl.on(Events.InteractionCreate, async (inter) => {
        await cp.Dispatch(inter);
    });

    cl.on(Events.MessageCreate, async (msg) => {
        await cp.Dispatch(msg);
    });


    // check user on connect to voice channel and send gif to text channel
    cl.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const GREETING_TIMEOUT = 5 * 60 * 1000;

      if (!(!oldState?.channel && !!newState?.channel)) return;

      try {
        const user = await UsersGif.findOne({
          where: {
            discordId: `<@${newState.member.user.id}>`,
            guildId: newState.guild.id,
          },
        });

        if (!user) return;

        if (
          !!user?.lastSent &&
          new Date().valueOf() - user.lastSent.valueOf() < GREETING_TIMEOUT
        ) return;

        const textChannelId = newState.channel.guild.channels.cache
          .filter((c) => c.type === ChannelType.GuildText)
          .first().id;

        const textChannel = cl.channels.cache.get(
          textChannelId
        ) as TextChannel;

        textChannel.send({
          embeds: [
            {
              title: `Кто это тут зашел? Ну привет, ${newState.member.user.username}`,
              image: {
                url: user.gif,
              },
              color: Math.floor(Math.random() * 16777215),
            },
          ],
        });

        await user.update({'lastSent': new Date()});

      } catch (error) {
        logger.error(error);
      }
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
