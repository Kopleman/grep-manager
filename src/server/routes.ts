
import * as Router from 'koa-router';
import { redisClient } from "./db";

const router = new Router();

router.get('/', async (ctx) => {
    await redisClient.setAsync('wtf', '1');
    ctx.body = 'Hello World!';
});

router.get('/test', async (ctx) => {
    let a = await redisClient.getAsync('wtf');
    console.log(a);
    ctx.status = 201;
    ctx.body = 'test';
});

export const routes = router.routes();