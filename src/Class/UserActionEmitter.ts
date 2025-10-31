import EventEmitter from 'events';
import { UserPromtResult } from '../Interface/UserPromtResult.js';
import { ButtonInteraction, GuildMember, Message, TextChannel } from 'discord.js';

interface UserActionEmitterEvents {
    action: [GuildMember, TextChannel, UserPromtResult, Message | ButtonInteraction]
}

export class UserActionEmitter extends EventEmitter<UserActionEmitterEvents> {
    emitOnMessage(msg: Message): void {
        if (msg.content.toLowerCase() === 'cancel') {
            this.emit('action', msg.member, msg.channel as TextChannel, 'cancel', msg);
            return;
        }
        const opt = parseInt(msg.content);
        if (opt) {
            this.emit('action', msg.member, msg.channel as TextChannel, opt, msg);
        }
    }
    emitOnButton(inter: ButtonInteraction): void {
        if (inter.customId === 'cancel') {
            this.emit('action', inter.member as GuildMember, inter.channel as TextChannel, 'cancel', inter);
        }
        const opt = parseInt(inter.customId);
        if (opt) {
            this.emit('action', inter.member as GuildMember, inter.channel as TextChannel, opt, inter);
        }
    }
}
