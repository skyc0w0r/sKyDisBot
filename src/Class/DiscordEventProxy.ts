import { ClientEvents, Events, VoiceState } from 'discord.js';
import EventEmitter from 'node:events';

type ProxyEvents = Pick<ClientEvents, 'voiceStateUpdate'>;

class DiscordEventProxy extends EventEmitter<ProxyEvents> {

}

export default DiscordEventProxy;
