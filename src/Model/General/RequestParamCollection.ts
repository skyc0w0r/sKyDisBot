interface RequestParamCollection {
    [key: string]:
        string |
        number |
        //RequestFile |
        RequestParamCollection |
        Array<RequestParamCollection>
}

export default RequestParamCollection;
