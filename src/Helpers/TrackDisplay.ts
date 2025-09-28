import { BaseCommand } from '../Model/CommandParser/index.js';
import { AudioTrack, WebTrack, YandexTrack, YouTubeTrack } from '../Model/AudioManager/index.js';
import { GuildAudioPlayer } from '../Class/GuildAudioPlayer.js';
import { EmbedBuilder } from 'discord.js';
import human from '../human.js';

export async function DisplaySingleTrack(cmd: BaseCommand, track: AudioTrack): Promise<void> {
    if (track instanceof YouTubeTrack) {
        await cmd.reply({ content: `Added **${track.Video.Snippet.Title}** to the queue!` });
    } else if (track instanceof YandexTrack) {
        await cmd.reply({ content: `Added **${track.Track.Title}** to the queue!` });
    } else {
        await cmd.reply({ content: `Added **${track.Title}** to the queue!` });
    }
}

export async function DisplayCurrentTrack(cmd: BaseCommand, player: GuildAudioPlayer): Promise<void> {
    let perc = player.PlayDuration / (player.Current.Duration || Infinity);
    perc = Math.floor(perc * 30);
    const begin = ''.padStart(perc, '=');
    const end = ''.padStart(30 - perc - 1, '=');
    const emb = new EmbedBuilder()
        .setAuthor({ name: 'Now playing' })
        .setTitle(`**${player.Current.Title}**`)
        .addFields({
            name: `${human.timeSpan(player.PlayDuration)}/${human.timeSpan(player.Current.Duration)}`,
            value: `\`\`\`[${begin}O${end}]\`\`\``,
        }, {
            name: 'Requested by',
            value: player.Current.Origin.User.nickname,
            inline: true,
        });

    if (player.Current instanceof YouTubeTrack) {
        emb.setURL(`https://youtu.be/${player.Current.Video.Id}`)
            .setThumbnail(player.Current.Video.Snippet.bestThumbnail.Url)
            .addFields({
                name: 'Channel',
                value: player.Current.Video.Snippet.ChannelTitle,
                inline: true,
            }).setColor('#FF3DCD');
    } else if (player.Current instanceof WebTrack) {
        emb.setURL(player.Current.Url.toString())
            .setColor('#FF3DCD');
    } else if (player.Current instanceof YandexTrack) {
        emb
            .setThumbnail(player.Current.Track.CoverUri.replace('%%', '200x200'))
            .addFields({
                name: 'Artist(s)',
                value: player.Current.Track.Artists.map(x => x.Name).join(' & '),
                inline: true,
            }).setColor('#FED42B');
    } else {
        await cmd.reply({ content: 'I dunno whats playing' });
        return;
    }

    await cmd.reply({ embeds: [emb] });
}

export async function DisplayTrackQueue(cmd: BaseCommand, player: GuildAudioPlayer): Promise<void> {
    const loopToEmoji = {
        'none': '➡',
        'one': '🔂',
        'all': '🔁',
    };

    const e = new EmbedBuilder()
        .setTitle(`Queue for ${cmd.Guild.name}`)
        .setDescription(`Loop: ${loopToEmoji[player.LoopMode]}`)
        .setColor('#FF3DCD')
        .setFooter({
            text: `Total: ${player.Queue.length} songs | Duration: ${human.timeSpan(player.Queue.reduce((sum, c) => sum + c.Duration, 0))}`
        });

    let nowText = '';
    if (player.Current instanceof YouTubeTrack) {
        nowText = `[${player.Current.Title}](https://youtu.be/${player.Current.Video.Id}) | ${human.timeSpan(player.Current.Duration)}`;
    } else if (player.Current instanceof WebTrack) {
        nowText = `[${player.Current.Title}](${player.Current.Url.toString()}) | ${human.timeSpan(player.Current.Duration)}`;
    } else if (player.Current instanceof YandexTrack) {
        nowText = `[${player.Current.Title}](https://music.yandex.com) | ${human.timeSpan(player.Current.Duration)}`;
    } else {
        nowText = 'I dont know what is it';
    }
    let index = 1;
    let queueText = '';
    for (const track of player.Queue.filter((_, i) => i <= 10)) {
        if (track instanceof YouTubeTrack) {
            queueText += `${index++}. [${track.Title}](https://youtu.be/${track.Video.Id}) | ${human.timeSpan(track.Duration)}\n`;
        } else if (track instanceof WebTrack) {
            queueText += `${index++}. [${track.Title}](${track.Url.toString()}) | ${human.timeSpan(track.Duration)}\n`;
        } else if (track instanceof YandexTrack) {
            queueText += `${index++}. [${track.Title}](https://music.yandex.com) | ${human.timeSpan(track.Duration)}\n`;
        } else {
            queueText += `${index++}. I dont know what is it\n`;
        }
    }
    e.addFields(
        {
            name: 'Now playing',
            value: nowText,
        },
        {
            name: 'Up next',
            value: queueText
        });
    await cmd.reply({
        embeds: [e]
    });
}
