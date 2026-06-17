import { flue } from '@flue/runtime/routing';
import { Hono, type MiddlewareHandler } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

app.route('/', flue());

export default app;
