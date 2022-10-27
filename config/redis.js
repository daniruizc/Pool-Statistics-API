import { createClient } from 'redis';

let redisCli;

(async () => {
    redisCli = createClient();

    redisCli.on('error', (err) => console.log('Redis Client Error', err));

    await redisCli.connect();
    console.log('Redis Connected'.magenta.bold);
})();

export default redisCli;
