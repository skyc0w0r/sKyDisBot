import { BaseService, Constructable } from '../Interface/ServiceManagerInterface.js';

class ServiceManager {
    private services: BaseService[];

    constructor() {
        this.services = [];
    }

    public async Init(): Promise<void> {
        await Promise.all(this.services.map(c => c.Init()));
    }

    public async Destroy(): Promise<void> {
        await Promise.all(this.services.map(c => c.Destroy()));
    }

    public AddService<T extends BaseService>(target: Constructable<T>, instance: T): ServiceManager {
        if (this.GetService(target)) {
            throw new Error(`This type is already registered: ${typeof(target)}`);
        }
        this.services.push(instance);

        return this;
    }

    public GetService<T extends BaseService>(target: Constructable<T>): T | null {
        for (const s of this.services) {
            if (s instanceof target) {
                return s;
            }
        }
        return null;
    }

    public GetRequiredService<T extends BaseService>(target: Constructable<T>): T {
        const res = this.GetService(target);
        if (!res) throw new Error(`Cannot find required service ${target}`);
        
        return res;
    }
}

const singleton = new ServiceManager();
function GlobalServiceManager(): ServiceManager {
    return singleton;
}

export { GlobalServiceManager };

export default ServiceManager;
