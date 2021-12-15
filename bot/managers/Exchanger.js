const {getDb} = require("../lib/database");
const {wait, eventLoopQueue} = require("../lib/helpers");
const ChangeCoin = require("../../backend/modules/ChangeCoin");
const {Telegraf} = require("telegraf");

const PAYMENT_CHECK_INTERVAL_SEC = process.env.PAYMENT_CHECK_INTERVAL_SEC;
const API_ROOT = process.env.TGAPI_ROOT || 'https://api.telegram.org'

module.exports = class Exchanger {
    constructor() {
        this.runLoop = null;
        this.stopCallback = null;
    }

    async getPendingTransactions() {
        let db = await getDb();
        return db.collection('transactions').find({
            status: {'$nin': ['done', 'error']},
            deleted: {'$in': [null, false]}
        }).toArray();
    }

    async processTransaction(transaction) {
        let db = await getDb();
        let exchanger = new ChangeCoin();

        exchanger.setDatabase( db );
        exchanger.setTransaction(transaction);
        exchanger.setStatusCallback(this.statusChanged.bind(this));
        exchanger.setCredentials(transaction.bot.apiKey, transaction.bot.secretKey);
        return exchanger.process();
    }

    getTelegram(transaction) {
        let token = transaction.bot.token;
        return new Telegraf(token, {telegram: {apiRoot: API_ROOT}}).telegram;
    }

    statusChanged(newStatus, transaction) {
        if (newStatus === 'done') {
            return this.transactionFinished(transaction);
        }

        if (newStatus === 'error') {
            return this.transactionError(transaction);
        }

        let statusText = {
            'new': 'Ожидание обработки',
            'create_invoice': 'Создание временного кошелька',
            'create_withdraw': 'Отправка монет',
            'wait_withdraw': 'Ожидание завершения перевода',
        }

        let tg = this.getTelegram(transaction);
        let user = transaction.user;
        if (newStatus === 'wait_invoice') {
            let hasUrl = transaction.invoice && transaction.invoice.flow_data && transaction.invoice.flow_data.action;

            let message = '';
            if (hasUrl) {
                message = `Для завершения обмена перейдите по адресу:
${transaction.invoice.flow_data.action}

и завершите перевод монет`;
            }
            else if (transaction.invoice.address) {
                message = `Для обмена монет был создан временный кошелек.
${transaction.invoice.address}

Пожалуйста, переведите на него: ${transaction.amount} ${transaction.fromCurrency} для завершения обмена.
Курс будет рассчитан на момент получения перевода`;
            }

            if (message) {
                return tg.sendMessage(user.id, message);
            }

            return;
        }

        let message = `${transaction.id}\n${statusText[newStatus]}`;
        return tg.sendMessage(user.id, message);
    }

    transactionFinished(transaction) {
        let tg = this.getTelegram(transaction);
        let user = transaction.user;
        let message = `${transaction.id}\nОбмен успешно завершен`;
        return tg.sendMessage(user.id, message);
    }

    transactionError(transaction) {
        let tg = this.getTelegram(transaction);
        let user = transaction.user;
        let message = `${transaction.id}
Возникла ошибка, обмен остановлен.

Обратитесь в техподдержку: ${transaction.bot.supportContacts}
Ошибка: ${transaction.lastError.err_description}`;
        return tg.sendMessage(user.id, message);
    }

    async processTransactions() {
        let transactions = await this.getPendingTransactions();

        if (transactions && transactions.length > 0) {
            for (const transaction of transactions) {
                await this.processTransaction(transaction);
            }
        }
    }

    stop() {
        this.runLoop = false;
        return new Promise(resolve => {
            this.stopCallback = resolve;
        });
    }

    launch() {
        return setTimeout(async () => {
            this.runLoop = true;

            while (this.runLoop) {
                await this.processTransactions();

                await wait(PAYMENT_CHECK_INTERVAL_SEC * 1000);
                await eventLoopQueue();
            }

            if (this.stopCallback) {
                this.stopCallback();
            }
        }, 0);
    }
}
