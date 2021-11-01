import { CommandCallback } from '../../Interface/CommandParserInterface.js';
import CommandParserService from '../../Service/CommandParserService.js';

export class RegisteredCommand {
    public Parser: CommandParserService;
    public Name: string;
    public Callback: CommandCallback;
    constructor(data: CommandData) {
        this.Parser = data.parser;
        this.Name = data.name;
        this.Callback = data.callback;
    }
}

interface CommandData {
    parser: CommandParserService;
    name: string,
    callback: CommandCallback
}
