export abstract class BaseService
{
    abstract Init(): Promise<void> | void;
    abstract Destroy(): Promise<void> | void;
}

export type Constructable<T> = new (...params: unknown[]) => T;
