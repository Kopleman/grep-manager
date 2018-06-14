import * as Promise from 'bluebird';
import * as Redis from 'redis';
import { config } from './config';

declare module 'redis' {
	export interface RedisClient extends NodeJS.EventEmitter {
		hdelAsync(...args: any[]): Promise<any>;
		hmgetAsync<T>(...args: any[]): Promise<T>;
		setAsync(key: string, value: string): Promise<void>;
		getAsync(key: string): Promise<string>;
		keysAsync(pattern: string): Promise<string[]>;
		scanAsync(cursor: number, options: string[]): Promise<[string, string[]]>;
		sscanAsync(key: string, cursor: string, options?: string[]): Promise<[string, string[]]>;
	}

	export interface Multi extends Redis.Commands<Multi> {
		execAsync(): Promise<any[]>;
	}
}
const RedisClient = Redis.RedisClient.prototype;
const Multi = Redis.Multi.prototype;
const RedisClientP = Promise.promisifyAll(Redis.RedisClient.prototype);
const MultiP = Promise.promisifyAll(Redis.Multi.prototype);

Redis.RedisClient.prototype = Object.assign(RedisClient, RedisClientP);
Redis.Multi.prototype = Object.assign(Multi, MultiP);

export const redisClient = Redis.createClient({ port: config.db.port }) as Redis.RedisClient;
