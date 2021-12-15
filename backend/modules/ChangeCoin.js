const axios = require("axios");
const crypto = require('crypto');
const uuid = require('uuid');
const moment = require("moment");
const clone = require("lodash.clonedeep");
const SECRET_KEY = process.env.CHANGECOINS_SECRET_KEY;
const API_KEY = process.env.CHANGECOINS_API_KEY;
const API_BASE = 'https://apimerchant.changecoins.io';
const SUCCESS_URL = 'http://humanistic.tech:8196/success'
const TIME_LIMIT_MINUTES = 24 * 60;

module.exports = class {
    constructor(transaction = null, db = null) {
        this.lastError = null;
        this.transaction = null;
        this.depositTransaction = null;
        this.withdrawTransaction = null;
        this.invoiceTransaction = null;
        this.db = null;

        this.apiKey = API_KEY || null;
        this.secretKey = SECRET_KEY || null;

        this.statusCallback = null;

        this.setTransaction(transaction);
        this.setDatabase(db);
    }

    generateNonce() {
        return crypto.randomBytes(16).readUInt32BE();
    }

    setCredentials(apiKey, secretKey) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    setTransaction(transaction = null) {
        this.transaction = transaction;
        this.depositTransaction = transaction ? transaction.deposit || null : null;
        this.withdrawTransaction = transaction ? transaction.withdraw || null : null;
        this.invoiceTransaction = transaction ? transaction.invoice || null : null;
    }

    setDatabase(db = null) {
        this.db = db;
    }

    setStatusCallback(callback = null) {
        this.statusCallback = callback;
    }

    callStatusCallback(newStatus, transaction) {
        if (this.statusCallback) {
            this.statusCallback(newStatus, transaction);
        }
    }

    async logRequest(url, payload, headers, response, error) {
        if (this.db) {
            return this.db.collection('requests').insertOne({
                url, payload, headers, response, error
            });
        }
    }

    async callApi(url, payload) {
        this.lastError = null;
        let headers = null;
        let fullUrl = `${API_BASE}${url}`;
        try {
            let stringPayload = JSON.stringify(payload);
            let base64Payload = Buffer.from(stringPayload).toString('base64');
            let signature = crypto.createHmac("sha256", this.secretKey)
                .update(base64Payload)
                .digest()
                .toString('hex');

            headers = {
                'X-Processing-Key': this.apiKey,
                'X-Processing-Signature': signature,
                'X-Processing-Payload': base64Payload
            }

            let {data: result} = await axios.post(fullUrl, payload, {headers});

            let hasError = result.err_code;
            let error = hasError ? result : null;
            await this.logRequest(fullUrl, payload, headers, result, error);

            if (hasError) {
                this.lastError = result;
            }
            else {
                return result;
            }
        }
        catch (e) {
            let error = {
                err_code: e.name,
                err_description: e.message,
                fileName: e.fileName,
                lineNumber: e.lineNumber,
                columnNumber: e.columnNumber,
                stack: e.stack
            }

            this.lastError = error;
            await this.logRequest(fullUrl, payload, headers, null, error);
        }

        return false;
    }

    async calculate() {
        let request = {};

        let calculationResult = await this.callApi('/v2/outcome/calc', request);

        return calculationResult
            ? calculationResult
            : false;
    }

    async createTransaction(fromCurrency, toCurrency, toAddress, amount = null, user = false, bot = null) {
        if (!this.db) {
            return false;
        }

        let result = await this.db.collection('transactions').insertOne({
            id: uuid.v4(),
            created: moment().unix(),
            status: 'new',
            fromCurrency,
            toCurrency,
            amount,
            toAddress,
            user,
            bot
        });

        let transaction = result.ops[0];

        this.setTransaction(transaction);
        this.callStatusCallback(transaction.status, transaction);
        return transaction;
    }

    async createDeposit() {
        if (this.depositTransaction) {
            return this.depositTransaction;
        }

        if (!this.canProcessCreate()) {
            return false;
        }

        let nonce = this.generateNonce();
        let currency = this.transaction.fromCurrency;
        if (currency === 'RUB' || currency === 'UAH') {
            currency = 'CARD'+currency;
        }

        let request = {
            externalid: 'd'+String(this.transaction.id),
            currency,
            nonce
        };

        let depositTransaction = await this.callApi('/v2/deposit/create', request);
        if (depositTransaction) {
            depositTransaction.nonce = nonce
            this.depositTransaction = depositTransaction;
            return depositTransaction;
        }

        return false;
    }

    async createInvoice() {
        if (this.invoiceTransaction) {
            return this.invoiceTransaction;
        }

        if (!this.canProcessInvoice()) {
            return false;
        }

        let nonce = this.generateNonce();
        let currency = this.transaction.fromCurrency;
        if (currency === 'RUB' || currency === 'UAH') {
            currency = 'CARD'+currency;
        }

        let returnUrl = this.transaction.bot
            ? 'https://t.me/'+this.transaction.bot.username
            : SUCCESS_URL;

        let request = {
            externalid: 'i'+String(this.transaction.id),
            amount: this.transaction.amount,
            currency,
            return_url: returnUrl,
            nonce,
            limit_minute: TIME_LIMIT_MINUTES
        };

        let invoiceTransaction = await this.callApi('/v2/invoice/create', request);
        if (invoiceTransaction) {
            invoiceTransaction.nonce = nonce
            this.invoiceTransaction = invoiceTransaction;
            return invoiceTransaction;
        }

        return false;
    }

    async reloadDeposit() {
        if (!this.depositTransaction) {
            return false;
        }

        let updatedDeposit = await this.callApi('/v2/transaction/status', {
            externalid: this.depositTransaction.externalid,
            nonce: this.generateNonce()
        });

        if (updatedDeposit) {
            return updatedDeposit;
        }

        return false;
    }

    async reloadInvoice() {
        if (!this.invoiceTransaction) {
            return false;
        }

        let updatedInvoice = await this.callApi('/v2/transaction/status', {
            externalid: this.invoiceTransaction.externalid,
            nonce: this.generateNonce()
        });

        if (updatedInvoice) {
            return updatedInvoice;
        }

        return false;
    }

    getWithdrawAmount() {
        if (!this.invoiceTransaction) {
            return false;
        }

        if (!this.transaction) {
            return false;
        }

        if (!this.transaction.rate) {
            return false;
        }

        let amount = this.transaction.amount
            ? this.transaction.amount
            : this.invoiceTransaction.amount;

        if (!amount) {
            return false;
        }

        return amount * this.transaction.rate.multiplier;
    }

    async getRates() {
        let changeCoinRates = await this.callApi('/v2/rate', {nonce: this.generateNonce()});
        return changeCoinRates;
    }

    async getRouteCurrencyRate(fromCurrencyRequest, toCurrencyRequest, rates = null) {
        let sameCurrencies = {
            "CARDRUB": "RUB",
            "TCSBRUB": "RUB",
            "SBERRUB": "RUB",
            "CARDUAH": "UAH"
        }

        let fromCurrency = fromCurrencyRequest;
        let toCurrency = toCurrencyRequest;

        if (sameCurrencies[fromCurrency]) {
            fromCurrency = sameCurrencies[fromCurrency];
        }

        if (sameCurrencies[toCurrency]) {
            toCurrency = sameCurrencies[toCurrency];
        }

        if (!rates) {
            rates = await this.getRates();

            if (!rates) {
                return false;
            }
        }

        /**
         * @var {{currency_from: string, currency_to: string, currency_rate: string, rate_buy: number, rate_sell: number}} targetRate
         */
        let targetRate = rates.find(rate => {
            let fromMatches = rate.currency_from === fromCurrency;
            let toMatches = rate.currency_to === toCurrency;
            if (!fromMatches && !toMatches) {
                fromMatches = rate.currency_from === toCurrency;
                toMatches = rate.currency_to === fromCurrency;
            }

            return fromMatches && toMatches;
        });

        if (targetRate) {
            let forwardMatch = targetRate.currency_from === fromCurrency;
            let rate = forwardMatch ? targetRate.rate_buy : targetRate.rate_sell;
            let multiplier = forwardMatch ? rate : 1/rate;

            return {
                rate,
                multiplier,
                inCurrency: targetRate.currency_rate
            }
        }

        return false;
    }

    async getTransactionCurrencyRate() {
        if (!this.transaction) {
            return false;
        }

        return this.getRouteCurrencyRate(this.transaction.fromCurrency, this.transaction.toCurrency);
    }

    async getBalances() {
        let changeCoinBalances = await this.callApi('/v2/balance', {nonce: this.generateNonce()});
        return changeCoinBalances;
    }

    async getRoutes() {
        let balances = await this.getBalances();
        let rates = await this.getRates();

        let haveBalance = Object.values(balances).filter(balanceInfo => balanceInfo.balance > 0);

        let routes = [];
        for (let fromInfo of Object.values(balances)) {
            for (let toInfo of haveBalance) {
                let fromCurrency = fromInfo.currency_type;
                let toCurrency = toInfo.currency_type;

                let rateInfo = await this.getRouteCurrencyRate(fromCurrency, toCurrency, rates);
                if (rateInfo) {
                    let maxCoins = parseFloat(toInfo.balance) / rateInfo.multiplier;
                    routes.push({
                        from: fromCurrency,
                        to: toCurrency,
                        max: maxCoins,
                        fromInfo,
                        toInfo,
                        rateInfo
                    })
                }
            }
        }

        return routes;
    }

    async createWithdraw() {
        if (this.withdrawTransaction) {
            return this.withdrawTransaction;
        }

        if (!this.canProcessWithdraw()) {
            return false;
        }

        if (!this.invoiceTransaction) {
            return false;
        }

        let memo = this.invoiceTransaction.memo || "";
        let currency = this.transaction.toCurrency;
        if (currency === 'RUB' || currency === 'UAH') {
            currency = 'CARD'+currency;
        }

        let nonce = this.generateNonce();
        let request = {
            externalid: 'w'+String(this.transaction.id),
            amount: this.getWithdrawAmount(),
            currency,
            nonce,
            userdata: {
                payee: this.transaction.toAddress,
                memo,
            }
        }

        let withdrawTransaction = await this.callApi('/v2/outcome/send', request);
        if (withdrawTransaction) {
            withdrawTransaction.nonce = nonce;
            this.withdrawTransaction = withdrawTransaction;
            return withdrawTransaction;
        }

        return false;
    }

    async reloadWithdraw() {
        if (!this.withdrawTransaction) {
            return false;
        }

        let updatedWithdraw = await this.callApi('/v2/transaction/outcome/status', {
            externalid: this.withdrawTransaction.externalid,
            nonce: this.generateNonce()
        });

        if (updatedWithdraw) {
            return updatedWithdraw;
        }

        return false;
    }

    canProcessCreate() {
        return Boolean(this.transaction && this.transaction.id && this.transaction.fromCurrency);
    }

    canProcessInvoice() {
        return Boolean(this.canProcessCreate() && this.transaction.amount > 0);
    }

    canProcessWithdraw() {
        return Boolean(this.transaction &&
            this.transaction.id &&
            this.transaction.toCurrency &&
            this.transaction.toAddress);
    }

    isUnprocessableError(error) {
        let unprocessableErrors = [
            102, //Request Data Error: GW Currency not configured, please contact to support
        ]

        let isUnprocessable = error && error.err_code && unprocessableErrors.indexOf(error.err_code) !== -1;
        return isUnprocessable;
    }

    async process() {
        let haveDataToProcess = this.canProcessInvoice() && this.canProcessWithdraw();
        if (!haveDataToProcess) {
            return false;
        }

        if (this.transaction.status === 'error' || this.transaction.status === 'done') {
            return false;
        }

        if (this.transaction.status === 'new') {
            await this.updateTransaction({status: 'create_invoice'});
            this.callStatusCallback(this.transaction.status, this.transaction);
        }

        if (this.transaction.status === 'create_invoice') {
            let invoiceTransaction = await this.createInvoice();
            if (invoiceTransaction) {
                await this.updateTransaction({
                    invoice: invoiceTransaction,
                    status: 'wait_invoice'
                });
                this.callStatusCallback(this.transaction.status, this.transaction);
            }
            else if (this.lastError) {
                await this.updateTransaction({
                    lastError: this.lastError,
                });

                if (this.isUnprocessableError(this.lastError)) {
                    await this.updateTransaction({status: 'error'});
                    this.callStatusCallback(this.transaction.status, this.transaction);
                }
            }
        }

        if (this.transaction.status === 'wait_invoice') {
            let freshInvoice = await this.reloadInvoice();
            if (freshInvoice.status !== this.invoiceTransaction.status) {
                this.invoiceTransaction = freshInvoice;
                let amount = freshInvoice.amount;
                let newStatus = 'wait_invoice';

                if (freshInvoice.status === 'done') {
                    newStatus = 'create_withdraw';
                }

                if (freshInvoice.status === 'fail' || freshInvoice.status === 'reject') {
                    newStatus = 'error';
                }

                await this.updateTransaction({invoice: freshInvoice, status: newStatus, amount});
                this.callStatusCallback(this.transaction.status, this.transaction);
            }
        }

        if (this.transaction.status === 'create_withdraw') {
            let rate = await this.getTransactionCurrencyRate();
            await this.updateTransaction({rate});

            let withdrawTransaction = await this.createWithdraw();
            if (withdrawTransaction) {
                await this.updateTransaction({
                    withdraw: withdrawTransaction,
                    status: 'wait_withdraw'
                });
                this.callStatusCallback(this.transaction.status, this.transaction);
            }
            else if (this.lastError) {
                await this.updateTransaction({
                    lastError: this.lastError,
                });

                if (this.isUnprocessableError(this.lastError)) {
                    await this.updateTransaction({status: 'error'});
                    this.callStatusCallback(this.transaction.status, this.transaction);
                }
            }
        }

        if (this.transaction.status === 'wait_withdraw') {
            let freshWithdraw = await this.reloadWithdraw();
            if (freshWithdraw.status !== this.withdrawTransaction.status) {
                this.withdrawTransaction = freshWithdraw;
                let newStatus = 'wait_withdraw';

                if (freshWithdraw.status === 'done') {
                    newStatus = 'done';
                }

                if (freshWithdraw.status === 'fail' || freshWithdraw.status === 'reject') {
                    newStatus = 'error';
                }

                await this.updateTransaction({deposit: freshWithdraw, status: newStatus});
                this.callStatusCallback(this.transaction.status, this.transaction);
            }
        }

        return this.transaction.status === 'done';
    }

    async updateTransaction(data) {
        if (data.status) {
            data.previous_status = this.transaction.status || null;
        }

        data.updated = moment().unix();

        if (data.status === 'done') {
            data.finished = moment().unix();
        }

        this.transaction = Object.assign(this.transaction, data);
        return this.saveTransaction();
    }

    async saveTransaction() {
        if (!this.db) {
            return false;
        }

        let transaction = clone(this.transaction);
        if (transaction._id) {
            delete transaction._id;
        }

        await this.db.collection('transactions').replaceOne({id: transaction.id}, transaction);
    }

}