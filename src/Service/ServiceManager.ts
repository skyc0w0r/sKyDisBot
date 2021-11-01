import { BaseService, Constructable } from '../Interface/ServiceManagerInterface.js';

class ServiceManager {
    private services: BaseService[];

    constructor() {
        this.services = [];
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
}

const singleton = new ServiceManager();
function GlobalServiceManager(): ServiceManager {
    return singleton;
}

export { GlobalServiceManager };

export default ServiceManager;
