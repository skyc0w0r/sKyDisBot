import Discord from 'discord.js';
import { GuildAudioPlayer } from './Class/GuildAudioPlayer.js';
import CommandParserService from './Service/CommandParserService.js';

function timeSpan(seconds: number): string {
    const s = seconds % 60;
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);

    const pad = (e: number) => e.toString().padStart(2, '0');
    if (h === 0) {
        return `${pad(m)}:${pad(s)}`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function size(bytes: number): string {
    const postfixes = [ 'B', 'KB', 'MB', 'GB' ];
    let index = 0;
    while (bytes >= 1024 && index < postfixes.length) {
        bytes /= 1024;
        index += 1;
    }
    const prefix = bytes % 1 === 0 ? bytes.toString() : bytes.toFixed(2);
    return `${prefix} ${postfixes[index]}`;
}

function _date(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth()+1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function _time(date: Date, withMs = false): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');

    return `${h}.${m}.${s}${withMs && ('.' + ms)}`;
}

function _dateTime(date: Date): string {
    return `${_date(date)}_${_time(date, true)}`;
}

function _s<T = unknown>(o: T): string {
    if (o instanceof Discord.Guild) {
        return `[Guild|${o.id}|${o.name}]`;
    }
    if (o instanceof Discord.GuildMember) {
        return `[GuildMember|${o.id}|${o.nickname}]`;
    }
    if (o instanceof Discord.BaseInteraction) {
        return `[Interaction|${o.type} by ${_s(o.member)} at ${_s(o.channel)}]`;
    }
    if (o instanceof Discord.User) {
        return `[User|${o.id}|${o.username}]`;
    }
    if (o instanceof Discord.TextChannel) {
        return `[TextCh|${o.id}|${o.name}]`;
    }
    if (o instanceof Discord.Message) {
        return `[Msg|${o.member && _s(o.member) || _s(o.author)} at ${_s(o.channel)} wrote ${o.id}|${o.content}]`;
    }
    if (o instanceof Discord.VoiceChannel) {
        return `[VoiceCh|${o.id}|${o.name}]`;
    }
    if (o instanceof CommandParserService) {
        return `[CmdParser|${o.FullName}]`;
    }
    if (o instanceof GuildAudioPlayer) {
        return `[Player|${_s(o.Guild)}${o.Channel && _s(o.Channel) || '(no channel)'}]`;
    }
    return '[type ???]';
}

export default {
    timeSpan,
    size,
    date: _date,
    time: _time,
    dateTime: _dateTime,
    _s,
};
