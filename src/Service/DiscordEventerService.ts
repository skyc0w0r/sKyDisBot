import { Client, Events } from "discord.js";
import { BaseService } from "../Interface/ServiceManagerInterface.js";
import DiscordEventProxy from "../Class/DiscordEventProxy.js";

class DiscordEventerService extends BaseService {
    private discord: Client;
    private proxy: DiscordEventProxy;

    public get Notify(): DiscordEventProxy {
        return this.proxy;
    }

    constructor(discordClient: Client) {
        super();
        this.discord = discordClient;
        this.proxy = new DiscordEventProxy();
    }

    Init(): Promise<void> | void {
        this.discord.on(Events.VoiceStateUpdate, (a, b) => this.proxy.emit(Events.VoiceStateUpdate, a, b));
    }
    Destroy(): Promise<void> | void {
        // this.discord.off(Events.VoiceStateUpdate);
    }
}

export default DiscordEventerService;
