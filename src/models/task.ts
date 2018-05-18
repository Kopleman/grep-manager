import * as Redis from 'redis';
import { redisClient } from '../server/db';
import * as crypto from 'crypto';

export class Task {
    public static create(domain: string, time?: number) {
        if (!domain) {
            throw new Error('Domain name is required');
        }
        const task = new Task(redisClient);
        task.time = time ? time : new Date().getTime();
        task.domain = domain;
        task.isCreate = true;
        return task;
    }
	private static _PREFIX_ = 'tasks:';
    /**
     * Возвращает имя ключа для Set
     * @returns {string}
     */
    private static setKey() {
        return `${Task._PREFIX_}set:`;
    }

    private static timeField() {
        return 'time';
    }

    private static domainField() {
        return 'domain';
    }
    
    private static fields() {
        return [
            Task.domainField(),
            Task.timeField()
        ];
    }
    
    public domain: string;
	public time: number;
	public filePath?: string;
	private isCreate: boolean = false;
    
	constructor(private client: Redis.RedisClient) {}

	get hash() {
		return this.getHash();
	}

	public getHash(domain?: string) {
        return crypto
            .createHash('md5')
            .update((domain || this.domain))
            .digest('hex');
	}
	
	public async save() {
		if (!this.isCreate) {
			throw new Error('Model must be created before save');
		}

		return this._save();
	}
    
	public remove() {
	    return this.client.multi([
            ['del', this.hashesKey()],
            ['srem', Task.setKey(), this.hash]
        ]).execAsync();
    }
	
    public async findByDomain(domain: string) {
        const q = [this.hashesKey(domain), ...Task.fields()];
        try {
            const data = await this.client.hmgetAsync<string[]>(q);
            if(data[0] && data[1]) {
                return Task.create(data[0], parseInt(data[1], 10));
            }
            return null;
        } catch (error) {
            throw error;
        }
        
    }
    
    /**
     * Возвращает имя ключа для Hashes
     */
    private hashesKey(domain?: string) {
        return `${Task._PREFIX_}${this.getHash(domain)}:`;
    }
    
	
	private _save() {
		return this.client.multi([
			['hmset', this.hashesKey(), Task.domainField(), this.domain, Task.timeField(), this.time],
			['sadd', Task.setKey(), this.hash]
		]).execAsync();
	}
}
