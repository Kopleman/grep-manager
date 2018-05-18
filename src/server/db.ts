import * as Promise from 'bluebird';
import * as Redis from 'redis';
import { config } from './config';
declare module 'redis' {
    export interface RedisClient extends NodeJS.EventEmitter {
        hdelAsync(...args: any[]): Promise<any>;
        setAsync(key:string, value:string): Promise<void>;
        getAsync(key:string): Promise<string>;
    }
}

const oldRedisClient = Redis.createClient({port: config.db.port});
export const redisClient = Promise.promisifyAll(oldRedisClient) as Redis.RedisClient;
