import Discord from 'discord.js';
import IAudioMessage from './IAudioMessage.js';

class AudioYTMessage implements IAudioMessage {
    public readonly msg: Discord.Message;
    public readonly videoId: string;
    constructor(msg: Discord.Message, videoId: string) {
        this.msg = msg;
        this.videoId = videoId;
    }
}

export default AudioYTMessage;
