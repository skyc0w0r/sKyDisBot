import Discord from 'discord.js';
import EventEmitter from 'events';
import { UserPromtResult } from '../Interface/UserPromtResult.js';

interface UserActionEmitterEvents {
    action: (user: Discord.GuildMember, channel: Discord.TextChannel, result: UserPromtResult, creator?: Discord.Message | Discord.ButtonInteraction) => void
}

export interface IUserActionEmitter {
    on<U extends keyof UserActionEmitterEvents>(
        event: U,
        listener: UserActionEmitterEvents[U]
    ): this
    emit<U extends keyof UserActionEmitterEvents>(
        event: U, ...args: Parameters<UserActionEmitterEvents[U]>
    ): boolean
    removeListener<U extends keyof UserActionEmitterEvents>(
        event: U,
        listener: UserActionEmitterEvents[U]
    ): this
}

// add listen for?
export class UserActionEmitter extends EventEmitter implements IUserActionEmitter {
    emitOnMessage(msg: Discord.Message): void {
        if (msg.content.toLowerCase() === 'cancel') {
            this.emit('action', msg.member, msg.channel as Discord.TextChannel, 'cancel', msg);
            return;
        }
        const opt = parseInt(msg.content);
        if (opt) {
            this.emit('action', msg.member, msg.channel as Discord.TextChannel, opt, msg);
        }
    }
    emitOnButton(inter: Discord.ButtonInteraction): void {
        if (inter.customId === 'cancel') {
            this.emit('action', inter.member as Discord.GuildMember, inter.channel as Discord.TextChannel, 'cancel', inter);
        }
        const opt = parseInt(inter.customId);
        if (opt) {
            this.emit('action', inter.member as Discord.GuildMember, inter.channel as Discord.TextChannel, opt, inter);
        }
    }
}
