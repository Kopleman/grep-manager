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
	port: process.env.NODE_PORT || '8088',
	prettyLog: process.env.NODE_ENV === 'development',
	db: {
		port: 6379
	},
	logsRoot: '/logbackup',
	folderForSave: 'storage',
	lookUpServers: ['ul1.ukit.com', 'ul2.ukit.com']
};

export { config };
