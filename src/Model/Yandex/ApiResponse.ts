class ApiResponse {
    public InvocationInfo: unknown;
    public Result: unknown;
    public Results: Array<unknown>;

    constructor(obj?: unknown) {
        this.InvocationInfo = obj && obj['invocationInfo'] || {};
        this.Result = obj && obj['result'] && !Array.isArray(obj['result']) && obj['result'] || {};
        this.Results = obj && obj['result'] && Array.isArray(obj['result']) && obj['result'] || [];
    }
}

export default ApiResponse;
