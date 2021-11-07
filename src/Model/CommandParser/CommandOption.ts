interface CommandOption {
    id: string
    description: string
    required?: boolean
    default?: string
    choices?: string[]
}

interface CommandCreationOptions {
    description?: string
    options?: CommandOption[]
}

interface CommandParam {
    id: string
    value: string
}

interface CommandParamCollection {
    [key: string]: CommandParam
}

export { CommandOption, CommandCreationOptions, CommandParam, CommandParamCollection };
