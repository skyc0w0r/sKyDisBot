import { join, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

interface Config {
    DIS_TOKEN: string
    LOG_CONFIG: string
    YT_DATA_TOKEN: string
    BOT_CLIENT_ID: string
    TEST_GUILD_ID: string
    COMMAND_PREFIX: string
    WEB_USER_AGENT: string
    YT_CUSTOM_COOKIE: string
}

const PLACEHOLDER = '[change_me]';
const DefaultConfig: Config = {
    DIS_TOKEN: PLACEHOLDER,
    LOG_CONFIG: 'log4js.default.json',
    YT_DATA_TOKEN: PLACEHOLDER,
    BOT_CLIENT_ID: PLACEHOLDER,
    TEST_GUILD_ID: PLACEHOLDER,
    COMMAND_PREFIX: '!',
    WEB_USER_AGENT: PLACEHOLDER,
    YT_CUSTOM_COOKIE: '',
};
const configPath = resolve(process.env.CONFIG_PATH || join(process.cwd(), 'config.json'));
let CurrentConfig: Config | undefined = undefined;

function checkConfig(): void {
    if (CurrentConfig) {
        return;
    }

    try {
        if (!existsSync(configPath)) {
            CurrentConfig = DefaultConfig;
            writeConfig();
            throw new Error('Fresh config, please replace [change_me] values');
        }

        const text = readFileSync(configPath, {'encoding': 'utf-8'});
        CurrentConfig = JSON.parse(text) as Config;

        const placeholders = new Array<string>();
        for (const key in DefaultConfig) {
            if (!(key in CurrentConfig)) {
                expandConfig();
                throw new Error('Config got expanded with new values, pleace check and restart');
            }
            if (typeof CurrentConfig[key] === 'string' && CurrentConfig[key] === PLACEHOLDER) {
                placeholders.push(key);
            }
        }
        if (placeholders.length > 0) {
            throw new Error(`Config has following unset values: ${placeholders.join(', ')}`);
        }
    }
    catch (e) {
        throw new Error(`Config check failed, inner message: ${e}`);        
    }
}

function getConfig(): Config {
    checkConfig();
    return CurrentConfig;
}

function writeConfig(): void {
    writeFileSync(configPath, JSON.stringify(CurrentConfig, null, 4));
}

function expandConfig(): void {
    // copy missing values from Default to Current
    for (const key in DefaultConfig) {
        if (!Object.keys(CurrentConfig).some(c => c === key)) {
            CurrentConfig[key] = DefaultConfig[key];
        }
    }
    writeConfig();
}

export default {
    get: getConfig,
    check: checkConfig
};
