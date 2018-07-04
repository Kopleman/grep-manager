import * as Router from 'koa-router';
import * as send from 'koa-send';
import { redisClient } from './db';
import { Task, TASK_STACK } from '../models/task';

const router = new Router();

router.get('/', async ctx => {
	// const cmd = Task.genCmd('test.web-dengi.net', {
	// 	from: '01/06/2018',
	// 	to: '05/06/2018'
	// });
	// const status = await redisClient.flushallAsync();
	// console.log(status);
	ctx.body = 'Hello World!';
});

router.get('/task', async ctx => {
	const modelTask = new Task(redisClient);
	const tasks = await modelTask.getAll();
	const _tasks: { [index: string]: Task } = {};
	if (tasks && tasks.length) {
		tasks.forEach(t => {
			delete t['client'];
			delete t['isCreate'];
			_tasks[t.hash] = t;
		});
	}
	ctx.response.status = 200;
	ctx.response.body = _tasks;
});

router.post('/task', async ctx => {
	const modelTask = new Task(redisClient);
	const body = ctx.request.body;
	const domain = body.domain;

	const query = {
		from: body.from,
		to: body.to
	};

	if (!domain) {
		ctx.throw(400, 'domain is required');
	}
	

	try {
		const task = await modelTask.findByDomainAndQuery(domain, query);
		if (task) {
			if (task.status === 'completed') {
				ctx.throw(409, 'The task already completed');
				return;
			}

			if (task.status === 'inProgress') {
				ctx.throw(409, 'The task is in progress');
				return;
			}

			if (task.status === 'failed') {
				task.status = 'inProgress';
				await task.save();
				ctx.response.status = 200;
				ctx.response.body = { id: task.hash };
				task.exec();
			}
		} else {
			const currentTaskCount = Object.keys(TASK_STACK).length;

			if (currentTaskCount >= 10) {
				ctx.throw(409, 'Tasks quota exceeded');
				return;
			}
			
			const newTask = Task.create({
				query: body,
				domain
			});
			await newTask.save();
			ctx.response.status = 200;
			ctx.response.body = { id: newTask.hash };
			newTask.exec();
		}
	} catch (err) {
		console.log(err);
		ctx.throw(500, err.toString());
	}
});

router.delete('/task/:id', async ctx => {
	const modelTask = new Task(redisClient);
	const id = ctx.params.id;
	if (!id) {
		ctx.response.body = { message: 'Id is not defined' };
		ctx.response.status = 404;

		ctx.throw(404, 'Id is not defined');
	}

	try {
		const task = await modelTask.findByHash(id);
		if (task) {
			if( TASK_STACK[task.hash] ) {
				await TASK_STACK[task.hash].kill();
				TASK_STACK[task.hash] = null;
			}
			await task.remove();
			ctx.response.status = 200;
			ctx.response.body = { message: 'ok' };
		} else {
			ctx.throw(404, 'Task not found');
		}
	} catch (err) {
		console.log(err);
		ctx.throw(500, err);
	}
});

router.get('/task/:id/download', async ctx => {
	const modelTask = new Task(redisClient);
	const id = ctx.params.id;
	if (!id) {
		ctx.response.body = { message: 'Id is not defined' };
		ctx.response.status = 404;

		ctx.throw(404, 'Id is not defined');
	}
	try {
		const task = await modelTask.findByHash(id);
		if (task) {
			ctx.set('Content-type', 'application/gzip');
			ctx.set('Content-disposition', `attachment; filename= ${task.fileName}`);
			await send(ctx, task.filePath);
		} else {
			ctx.throw(404, 'Task not found');
		}
	} catch (err) {
		console.log(err);
		ctx.throw(500, err);
	}
});

router.get('/test', async ctx => {
	ctx.status = 201;
	ctx.body = 'test';
});

export const routes = router.routes();
