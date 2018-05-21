export interface IConfig {
	port: string;
	prettyLog: boolean;
	db: {
		port: number;
	};
}

const config: IConfig = {
	port: process.env.NODE_PORT || '6369',
	prettyLog: process.env.NODE_ENV == 'development',
	db: {
		port: 6370
	}
};

export { config };
