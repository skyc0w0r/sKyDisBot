import { CommandCallback } from '../../Interface/CommandParserInterface.js';
import CommandParserService from '../../Service/CommandParserService.js';
import { CommandCreationOptions, CommandOption } from './CommandOption.js';

export class RegisteredCommand {
    public Parser: CommandParserService;
    public Name: string;
    public get FullName(): string {
        return `${this.Parser.FullName}${this.Name}`;
    }
    public Callback: CommandCallback;
    public Description: string;
    public Arguments: CommandOption[];
    constructor(data: CommandData) {
        this.Parser = data.parser;
        this.Name = data.name;
        this.Callback = data.callback;
        data.opts = data.opts || {};
        this.Description = data.opts.description ?? 'No description provided';
        this.Arguments = data.opts.options || [];
    }
}

interface CommandData {
    parser: CommandParserService;
    name: string,
    callback: CommandCallback
    opts?: CommandCreationOptions
}
