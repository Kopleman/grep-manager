import * as Koa from 'koa';
import * as Redis from 'redis';
import { redisClient } from '../server/db';
import { config } from '../server/config';
import * as crypto from 'crypto';
import * as moment from 'moment';
import * as execa from 'execa';
import * as _ from 'lodash';
import { asyncForEach } from '../utils';

export const TASK_STACK: any = {};
export let JUST_STARTED: boolean = true;

export interface ITimeQuery {
	from: string;
	to: string;
}

export interface ITask {
	domain: string;
	time: number;
	filePath: string;
	fileName: string;
	cmd: string;
	query?: ITimeQuery;
	status: 'inProgress' | 'completed' | 'failed';
}

export class Task implements ITask {
	public static genCmd(domain: string, query?: ITimeQuery) {
		if (!query) {
			query = {
				from: moment().format('DD/MM/YYYY'),
				to: moment().format('DD/MM/YYYY')
			};
		}
		const from = moment(query.from, 'DD/MM/YYYY');
		const to = moment(query.to, 'DD/MM/YYYY');

		if(from.diff(to, 'days') < 0 ) {
			throw new Error('"From" is  higher than "To"!');
		}
		
		const fileName = `${domain}-${from.format('YYYYMMDD')}-${to.format('YYYYMMDD')}.txt.gz`;
		const filePath = `${config.folderForSave}/${fileName}`;
		let whereStr = '';
		for (const m = moment(from); m.diff(to, 'days') <= 0; m.add(1, 'days')) {
			config.lookUpServers.forEach(serverName => {
				whereStr += `${config.logsRoot}/${serverName}/nginx/nginx.log-${m.format('YYYYMMDD')}.gz `;
			});
		}
		const cmd = `zgrep --no-filename ${domain} ${whereStr} | gzip > ${filePath}`;
		return {
			cmd,
			fileName,
			filePath
		};
	}

	public static create(taskData: { [key: string]: any }) {
		if (!taskData.domain) {
			throw new Error('Domain name is required');
		}
		const task = new Task(redisClient);
		task.time = taskData.time ? taskData.time : new Date().getTime();
		task.domain = taskData.domain;
		task.query = taskData.query;

		if (!taskData.cmd) {
			const cmdData = Task.genCmd(task.domain, task.query);
			task.fileName = cmdData.fileName;
			task.filePath = cmdData.filePath;
			task.cmd = cmdData.cmd;
		} else {
			task.fileName = taskData.fileName;
			task.filePath = taskData.filePath;
			task.cmd = taskData.cmd;
		}
		task.status = taskData.status ? taskData.status : 'inProgress';
		task.isCreate = true;
		return task;
	}

	public static async onInit(ctx: Koa.Context, next: () => Promise<any>) {
		if (!JUST_STARTED) {
			await next();
			return;
		}
		JUST_STARTED = false;
		const modelTask = new Task(redisClient);
		try {
			const tasks = await modelTask.getAll();
			await asyncForEach(tasks, async (task: Task) => {
				if (task.status === 'inProgress') {
					task.status = 'failed';
					await task.save();
				}
			});
			await next();
		} catch (err) {
			throw err;
		}
	}

	private static readonly _PREFIX_ = 'tasks:';
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

	private static queryField() {
		return 'query';
	}

	private static cmdField() {
		return 'cmd';
	}

	private static filePathField() {
		return 'filePath';
	}

	private static fileNameField() {
		return 'fileName';
	}

	private static statusField() {
		return 'status';
	}

	private static fields() {
		return [
			Task.domainField(),
			Task.timeField(),
			Task.queryField(),
			Task.cmdField(),
			Task.filePathField(),
			Task.fileNameField(),
			Task.statusField()
		];
	}

	private static parseDataFromBd(data: string[]) {
		const fields = Task.fields();
		const ret: { [key: string]: any } = {};
		fields.forEach((fieldName, index) => {
			ret[fieldName] = data[index];
		});

		if (!ret.query) {
			ret.query = {};
		} else {
			ret.query = JSON.parse(ret.query);
		}
		if (!ret.domain) {
			return null;
		}
		if (Object.keys(ret).length === fields.length) {
			return ret;
		}

		return null;
	}

	public domain: string;
	public time: number;
	public filePath: string;
	public fileName: string;
	public cmd: string;
	public query: { from: string; to: string };
	public status: 'inProgress' | 'completed' | 'failed';
	private isCreate: boolean = false;

	constructor(private client: Redis.RedisClient) {}

	get hash() {
		return this.getHash();
	}

	public async exec() {
		if (TASK_STACK[this.hash]) {
			throw new Error('Task already existed');
		}

		const promise = execa.shell(this.cmd);

		TASK_STACK[this.hash] = promise;

		try {
			await promise;
			this.status = 'completed';
			TASK_STACK[this.hash] = null;
			await this.save();
		} catch (err) {
			console.log(err);
			this.status = 'failed';
			TASK_STACK[this.hash] = null;
			await this.save();
		}
	}

	public getHash(domain?: string, query?: ITimeQuery) {
		const strToHash = domain
			? Task.genCmd(domain, query).cmd
			: Task.genCmd(this.domain, this.query).cmd;

		return crypto
			.createHash('md5')
			.update(strToHash)
			.digest('hex');
	}

	public async save() {
		if (!this.isCreate) {
			throw new Error('Model must be created before save');
		}

		return this._save();
	}

	public remove() {
		return this.client
			.multi([['del', this.hashesKey()], ['srem', Task.setKey(), this.hash]])
			.execAsync();
	}

	public async findByDomainAndQuery(domain: string, query: ITimeQuery) {
		const q = [this.hashesKey(domain, query), ...Task.fields()];
		try {
			const dataFromDb = await this.client.hmgetAsync<string[]>(q);

			const data = Task.parseDataFromBd(dataFromDb);

			if (data) {
				return Task.create(data);
			}

			return null;
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	public async findByHash(id: string) {
		const q = [`${Task._PREFIX_}${id}:`, ...Task.fields()];
		try {
			const dataFromDb = await this.client.hmgetAsync<string[]>(q);

			const data = Task.parseDataFromBd(dataFromDb);
			if (data) {
				return Task.create(data);
			}

			return null;
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	public async getAll() {
		const keys = await this.client.sscanAsync(Task.setKey(), '0');
		const tasks: Task[] = [];
		await asyncForEach(keys[1], async (k: string) => {
			const task = await this.findByHash(k);
			tasks.push(task);
		});

		return tasks;
	}

	/**
	 * Возвращает имя ключа для Hashes
	 */
	private hashesKey(domain?: string, query?: ITimeQuery) {
		return `${Task._PREFIX_}${this.getHash(domain, query)}:`;
	}

	private _save() {
		const dataObj = {
			domain: this.domain,
			time: this.time,
			filePath: this.filePath,
			fileName: this.fileName,
			cmd: this.cmd,
			query: JSON.stringify(this.query),
			status: this.status
		};

		const dataArray = _.flatten(Object.entries(dataObj));
		return this.client
			.multi([['hmset', this.hashesKey(), ...dataArray], ['sadd', Task.setKey(), this.hash]])
			.execAsync();
	}
}
