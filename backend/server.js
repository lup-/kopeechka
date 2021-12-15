const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const multer = require('@koa/multer');

const users = require('./routes/users');
const transactions = require('./routes/transactions');
const mailings = require('./routes/mailings');
const bots = require('./routes/bots');
const stats = require('./routes/stats');
const files = require('./routes/files');

const PORT = 3000;
const HOST = '0.0.0.0';
const UPLOAD_DIR = process.env.UPLOAD_DIR;

const app = new Koa();
const router = new Router();
const upload = multer({dest: UPLOAD_DIR});

router
    .post('/api/transaction/list', transactions.list.bind(transactions));

router
    .post('/api/user/list', users.list.bind(users))
    .post('/api/user/add', users.add.bind(users))
    .post('/api/user/update', users.update.bind(users))
    .post('/api/user/delete', users.delete.bind(users))
    .post('/api/user/check', users.check.bind(users))
    .post('/api/user/login', users.login.bind(users));

router
    .post('/api/stats/list', stats.general.bind(stats))
    .post('/api/stats/details', stats.details.bind(stats));

router
    .post('/api/mailing/list', mailings.list.bind(mailings))
    .post('/api/mailing/add', mailings.add.bind(mailings))
    .post('/api/mailing/update', mailings.update.bind(mailings))
    .post('/api/mailing/delete', mailings.delete.bind(mailings));

router
    .post('/api/bots/list', bots.list.bind(bots))
    .post('/api/bots/add', bots.add.bind(bots))
    .post('/api/bots/update', bots.update.bind(bots))
    .post('/api/bots/delete', bots.delete.bind(bots))
    .post('/api/bots/restart', bots.restart.bind(bots));

router
    .post('/api/file/link', upload.single('file'), files.getLink.bind(files))
    .post('/api/file/delete', files.deleteFile.bind(files));

app
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '1mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, HOST);