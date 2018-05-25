import * as Router from 'koa-router';
import { redisClient } from './db';
import { Task, TASK_STACK } from '../models/task';

const router = new Router();

router.get('/', async ctx => {
	const abc = Task.create({domain: 'abc'});
	await abc.save();
	ctx.body = 'Hello World!';
});

router.post('/task', async ctx => {
	const modelTask = new Task(redisClient);
	const body = ctx.request.body;
	const domain = body.domain;
	
	const query = {
		year: body.year,
		month: body.month
	};
	
	if (!domain) {
		ctx.throw(400, 'domain is required');
	}
	const currentTaskCount = Object.keys(TASK_STACK).length;

	if( currentTaskCount >= 10 ) {
		ctx.response.body = { message: 'Tasks quota exceeded' };
	}
	
	try {
		const task = await modelTask.findByDomainAndQuery(domain, query);
		if (task) {
			console.log(task.getHash());
			if( task.status === 'completed') {
				ctx.response.status = 409;
				ctx.response.body = { message: 'Task already completed' };			
			}

			if( task.status === 'inProgress') {
				ctx.response.status = 409;
				ctx.response.body = { message: 'Task is in progress' };
			}
			
			if( task.status === 'failed') {
				task.status = 'inProgress';
				await task.save();
				ctx.response.status = 200;
				ctx.response.body = { id: task.hash };
				task.exec();
			}
			
		} else {
			const task = Task.create({
				query: body,
				domain
			});
			console.log(task.getHash());
			await task.save();
			ctx.response.status = 200;
			ctx.response.body = { id: task.hash };
			task.exec();
			
		}
	} catch (err) {
		console.log(err);
		ctx.throw(500, err);
	}
});

router.delete('/task/:id', async ctx => {
	const modelTask = new Task(redisClient);
	const id = ctx.params.id;
	console.log(ctx);
	if( !id ) {
		ctx.response.body = { message: 'Id is not defined' };
		ctx.response.status = 404;
		
		ctx.throw(404, 'Id is not defined');
	}
	
	try {
		const task = await modelTask.findByHash(id);
		if( task ){
			await task.remove();
			console.log('removed');
			ctx.response.status = 200;
			ctx.response.body = { message: 'ok' };
		} else {
			ctx.throw(404, 'Task not found');
		}
	}catch (err) {
		console.log(err);
		ctx.throw(500, err);
	}
});

router.get('/test', async ctx => {
	

	ctx.status = 201;
	ctx.body = 'test';
});

export const routes = router.routes();
