const {getDb} = require('../lib/database');
const setupBot = require('../lib/setup');

const COLLECTION_NAME = 'bots';

module.exports = class BotManager {
    constructor() {
        this.runningBots = [];
        this.allBots = [];
        this.botFunnels = [];
    }

    async blockedHandler(ctx, next) {
        if (ctx && ctx.profile) {
            await ctx.profile.setBlocked();
        }
        return next();
    }

    async createBot(bot) {
        console.log(`Starting bot ${bot.username}...`)

        let app = setupBot(bot)
            .blockNonPrivate()
            .addSubscription()
            .addExchanger()
            .addSession({})
            .addSafeReply(this.blockedHandler)
            .addIdsToSession()
            .addRefSave()
            .addUserSave()
            .addProfile()
            .addSaveActivity()
            .addHandleBlocks()
            .addScenes()
            .addDisclaimer(bot.introMessage, ctx => {
                return ctx.scene.enter('exchange', {bot});
            })
            .addDefaultRoute(ctx => {
                return ctx.scene.enter('exchange', {bot});
            })
            .get();

        app.botDbId = bot.id;
        try {
            await app.launch();
        }
        catch (e) {
            console.error(e);
            return false;
        }

        return app;
    }

    stopBot(botToStop) {
        let botIndex = this.allBots.findIndex(bot => bot.id === botToStop.id);
        if (botIndex !== -1) {
            let runningBot = this.runningBots.splice(botIndex, 1)[0];
            return runningBot && runningBot.stop ? runningBot.stop() : false;
        }
    }

    async restartBot(botToRestart) {
        await this.stopBot(botToRestart);
        this.createBot(botToRestart);
    }

    async loadBots() {
        let filter = {
            'token': {$nin: [null, false]},
            'stopped': {$in: [null, false]},
            'deleted': {$in: [null, false]}
        };

        let db = await getDb();
        this.allBots = await db.collection(COLLECTION_NAME).find(filter).toArray();
    }

    async launchBotList(bots) {
        let runningBots = []
        for (let bot of bots) {
            let runningBot = await this.createBot(bot);
            if (runningBot) {
                runningBots.push(runningBots);
            }
        }

        return runningBots;
    }

    async launchBots() {
        await this.loadBots();
        this.runningBots = await this.launchBotList(this.allBots);
        return this.runningBotsInfo();
    }

    async launchNewBots() {
        await this.loadBots();
        let runningBotUsernames = this.runningBots.map(telegraf => telegraf.botInfo.username);
        let allUsernames = this.allBots.map(bot => bot.username);
        let newBotNames = allUsernames.filter(name => runningBotUsernames.indexOf(name) === -1);
        if (newBotNames.length > 0) {
            let newBots = this.allBots.filter(bot => newBotNames.indexOf(bot.username) !== -1);
            let newRunningBots = await this.launchBotList(newBots);
            this.runningBots = this.runningBots.concat(newRunningBots);
        }

        return newBotNames.length;
    }

    async stopOldBots() {
        await this.loadBots();
        let runningBotUsernames = this.runningBots.map(telegraf => telegraf.botInfo ? telegraf.botInfo.username : false);
        let allUsernames = this.allBots.map(bot => bot.username);
        let missingNames = runningBotUsernames.filter(name => allUsernames.indexOf(name) === -1);
        if (missingNames.length > 0) {
            let missingBotIds = this.runningBots
                .filter(telegraf => missingNames.indexOf(telegraf.botInfo.username) !== -1)
                .map(telegraf => telegraf.botDbId);

            for (const id in missingBotIds) {
                await this.stopBot({id});
            }
        }

        return missingNames.length;
    }

    async syncBots() {
        let newBots = await this.launchNewBots();
        let oldBots = await this.stopOldBots();

        return {newBots, oldBots};
    }

    async runningBotsInfo() {
        return this.runningBots.map(telegraf => telegraf.botInfo);
    }

    async stopAllBots() {
        let promises = this.runningBots.map(telegraf => this.stopBot({id: telegraf.botDbId}));
        return await Promise.all(promises);
    }

    async restartAll() {
        await this.stopAllBots();
        return this.launchBots();
    }
}