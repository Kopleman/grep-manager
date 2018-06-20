export interface IConfig {
	port: string;
	prettyLog: boolean;
	db: {
		port: number;
	};
	logsRoot: string;
	folderForSave: string;
	lookUpServers: string[];
}

const config: IConfig = {
	port: process.env.NODE_PORT || '6369',
	prettyLog: process.env.NODE_ENV === 'development',
	db: {
		port: 6370
	},
	logsRoot: 'log/',
	folderForSave: '',
	lookUpServers: ['ul1', 'ul2']
};

export { config };
