const Mailer = require('./managers/Mailer');
const Bots = require('./managers/Bots');
const HttpInterface = require('./httpInterface');
const Exchanger = require('./managers/Exchanger');

const mailer = new Mailer();
const bots = new Bots();
const http = new HttpInterface(bots);
const exchanger = new Exchanger();

(async () => {
    await bots.launchBots();
    mailer.setBlockedHandler(mailer.blockUser);
    mailer.launch();
    http.launch();
    exchanger.launch();

    process.on('SIGTERM', async () => {
        console.info('Получен сигнал SIGTERM, завершаю работу');
        await mailer.stop();
        process.exit();
    });
})();
