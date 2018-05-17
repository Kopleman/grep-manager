
export interface IConfig {
    port: string;
    prettyLog: boolean;
}

const config : IConfig = {
    port: process.env.NODE_PORT || '3000',
    prettyLog: process.env.NODE_ENV == 'development',
};

export { config };