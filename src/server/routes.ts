
import * as Router from 'koa-router';
import { redisClient } from './db';
import { Task } from '../models/task';

const router = new Router();

router.get('/', async (ctx) => {
    const abc  = Task.create('abc');
    await abc.save();
    ctx.body = 'Hello World!';
});

router.get('/test', async (ctx) => {
    const modelTask = new Task(redisClient);
    try {
        const abc = await modelTask.findByDomain('abc');
        if(abc) {
            console.log(abc);
            console.log('Domain found name: ' + abc.domain + '; time: ' + abc.time);

            await abc.remove();
            console.log('removed');
        }else {
            console.log('record was not found');
        }
    } catch (err) {
        console.log(err)
    }
    
    ctx.status = 201;
    ctx.body = 'test';
});

export const routes = router.routes();