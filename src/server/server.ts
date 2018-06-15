import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import { config } from './config';
import { logger } from './logging';
import { routes } from './routes';
import { Task } from '../models/task';

const app = new Koa();


app.use(logger);
app.use(bodyParser());
app.use(Task.onInit);
app.use(routes);


app.listen(config.port);

console.log(`Server running on port ${config.port}`);
