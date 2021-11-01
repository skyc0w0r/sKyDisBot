import Discord from 'discord.js';
import DSRest from '@discordjs/rest';
import DSTypes from 'discord-api-types/v9';
import DSVoice, { AudioPlayerStatus } from '@discordjs/voice';
import Logger from 'log4js';
import proccess from 'process';
import config from './config.js';
import human from './human.js';
import YouTubeService from './Service/YouTubeService.js';
import AudioConverter from './Service/AudioConverter.js';
import AudioManagerService from './Service/AudioManagerService.js';
import { GlobalServiceManager } from './Service/ServiceManager.js';
import CommandParserService from './Service/CommandParserService.js';

// const commands: Discord.ApplicationCommandDataResolvable[] = [
//     {
//         name: 'ok',
//         description: 'Are you okay?'
//     },
//     {
//         name: 'dick',
//         description: 'Dick check',
//         options: [
//             {
//                 name: 'softness',
//                 description: 'hard agree?',
//                 required: true,
//                 type: 3,
//                 choices: [
//                     {
//                         name: 'Hard',
//                         value: 'hard'
//                     },
//                     {
//                         name: 'Soft',
//                         value: 'soft'
//                     }
//                 ]
//             }
//         ]
//     },
//     {
//         name: 'play',
//         description: 'plays music'
//     }
// ];

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
    
    cp.RegisterCommand('help', async (c) => {
        if (c.isByMessage()) {
            await c.Channel.send({ content: 'put help message here' });
        }
        else if (c.isByInteraction()) {
            await c.Interaction.reply({ content: 'put help message here' });
        }
    });
    const util = cp.RegisterCategory('util');
    util.RegisterCommand('who', async (c) => {
        if (c.isByMessage()) {
            await c.Channel.send({ content: `id: ${c.User}` });
        }
        else if (c.isByInteraction()) {
            await c.Interaction.reply({ content: `id: ${c.User}` });
        }
    });
    util.RegisterCategory('test').RegisterCommand('ping', async (c) => {
        if (c.isByMessage()) {
            await c.Channel.send({ content: `ping: ${cl.ws.ping}` });
        }
        else if (c.isByInteraction()) {
            await c.Interaction.reply({ content: `ping: ${cl.ws.ping}` });
        }
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

        // logger.debug('Interaction:', human._s(inter));
        // if (!inter.isCommand()) {
        //     return;
        // }

        // if (inter.commandName === 'ok') {
        //     await inter.reply({content: 'ok 👍'});
        // }
        // if (inter.commandName === 'dick') {
        //     const sf = inter.options.data.find(c => c.name === 'softness');
        //     if (!sf) {
        //         await inter.reply('how?');
        //         return;
        //     }
        //     await inter.reply({content: sf.value === 'hard' ? 'Agree 🍆' : 'Disagree 🥒'});
        // }
        // if (inter.commandName === 'play') {
        //     await inter.deferReply();
        //     if (!(inter.member instanceof Discord.GuildMember)) {
        //         return;
        //     }
        //     const voice = DSVoice.joinVoiceChannel({
        //         channelId: inter.member.voice.channel.id,
        //         guildId: inter.member.voice.channel.guild.id,
        //         adapterCreator: inter.member.voice.channel.guild.voiceAdapterCreator as unknown as DSVoice.DiscordGatewayAdapterCreator,
        //     });

        //     await DSVoice.entersState(voice, DSVoice.VoiceConnectionStatus.Ready, 20e3);
        //     const res = DSVoice.createAudioResource('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3', {inputType: DSVoice.StreamType.Arbitrary});
        //     const player = DSVoice.createAudioPlayer();
        //     voice.subscribe(player);
        //     player.play(res);
        //     await DSVoice.entersState(player, DSVoice.AudioPlayerStatus.Playing, 5e3);
        //     player.on('stateChange', (o, n) => {
        //         if (n.status === DSVoice.AudioPlayerStatus.Playing) {
        //             inter.followUp({ content: 'Now playing...', ephemeral: true });
        //         }
        //         if (n.status === DSVoice.AudioPlayerStatus.Idle) {
        //             inter.followUp({ content: 'Finished playing', ephemeral: true });
        //             player.stop();
        //             voice.destroy();
        //         }
        //     });
        // }
    });

    cl.on('messageCreate', async (msg) => {
        await cp.Dispatch(msg);
    });
    
    await cl.login(config.get().DIS_TOKEN);
    
    const bye = async () => {
        logger.info('Got termination signal, shutting down');
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
    };
    proccess.on('SIGINT', bye);
    proccess.on('SIGTERM', bye);
}

main();
