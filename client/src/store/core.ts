import { Store } from "../core/store";

interface CoreState {
    authenticated: boolean;
    initialized: boolean;
    loading: boolean;
    username: string;
    email?: string;
    version: { release: string; env: string };
    changelog: string;
}

class CoreStore extends Store<CoreState> {
    protected data(): CoreState {
        return {
            authenticated: false,
            initialized: false,
            username: "",
            loading: false,
            version: { release: "", env: "" },
            changelog: "",
        };
    }

    setInitialized(initialized: boolean): void {
        this._state.initialized = initialized;
    }

    setAuthenticated(authenticated: boolean): void {
        this._state.authenticated = authenticated;
    }

    setLoading(loading: boolean): void {
        this._state.loading = loading;
    }

    setUsername(username: string): void {
        this._state.username = username;
    }

    setEmail(email: string): void {
        this._state.email = email;
    }

    setChangelog(changelog: string): void {
        this._state.changelog = changelog;
    }

    setVersion(version: { release: string; env: string }): void {
        this._state.version = version;
    }
}

export const coreStore = new CoreStore();
(window as any).coreStore = coreStore;
