const {getDb} = require('../modules/Database');
const ChangeCoin = require('../modules/ChangeCoin');

test('calculation', async () => {
    const exchanger = new ChangeCoin();
    let result = await exchanger.calculate();
    expect(result).not.toBeFalsy();
});

test('getRates', async () => {
    const emptyExchanger = new ChangeCoin();
    let rates = await emptyExchanger.getRates();
    expect(rates).not.toBeFalsy();
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].currency_from).not.toBeFalsy();
});

test('getTransactionCurrencyRate', async () => {
    const exchangerUSDTRUB = new ChangeCoin();
    exchangerUSDTRUB.setTransaction({id: 1, fromCurrency: 'USDTTRC', toCurrency: 'RUB'});

    const exchangerRUBUSDT = new ChangeCoin();
    exchangerRUBUSDT.setTransaction({id: 1, fromCurrency: 'RUB', toCurrency: 'USDTTRC'});

    let USDTRUBRate = await exchangerUSDTRUB.getTransactionCurrencyRate();
    let RUBUSDTRate = await exchangerRUBUSDT.getTransactionCurrencyRate();

    expect(USDTRUBRate).not.toBeFalsy();
    expect(RUBUSDTRate).not.toBeFalsy();
    expect(USDTRUBRate.inCurrency).not.toBeFalsy();
    expect(RUBUSDTRate.inCurrency).not.toBeFalsy();
    expect(USDTRUBRate.inCurrency).toEqual(RUBUSDTRate.inCurrency);
    expect(RUBUSDTRate.rate).toBeGreaterThan(USDTRUBRate.rate);

    let RUBfor1USDT = 1 * USDTRUBRate.multiplier;
    let USDTfor1RUB = 1 * RUBUSDTRate.multiplier;
    expect(RUBfor1USDT).toBeGreaterThan(1);
    expect(USDTfor1RUB).toBeGreaterThan(0);
    expect(USDTfor1RUB).toBeLessThan(1);
});

test('getBalances', async () => {
    const emptyExchanger = new ChangeCoin();
    let balances = await emptyExchanger.getBalances();
    expect(balances).not.toBeFalsy();
    expect(balances['USDTTRC']).not.toBeFalsy();
    expect(balances['USDTTRC'].alpha3).toEqual('USDT');
});

test('getRoutes', async () => {
    const emptyExchanger = new ChangeCoin();
    let routes = await emptyExchanger.getRoutes();
    expect(routes).not.toBeFalsy();
});

test('createDeposit', async () => {
    const emptyExchanger = new ChangeCoin();
    let deposit = await emptyExchanger.createDeposit();
    expect(deposit).toBeFalsy();

    const wrongExchanger = new ChangeCoin({id: 1});
    deposit = await wrongExchanger.createDeposit();
    expect(deposit).toBeFalsy();

    const alreadyCreatedExchanger = new ChangeCoin({id: 1, deposit: {id: '123'}});
    deposit = await alreadyCreatedExchanger.createDeposit();
    expect(deposit).not.toBeFalsy();
    expect(deposit.id).toEqual('123');

    const exchanger = new ChangeCoin({id: 1, fromCurrency: 'BTC'});
    let transaction = await exchanger.createDeposit();
    expect(transaction).not.toBeFalsy();
    expect(transaction.id).toBeGreaterThan(0);
    expect(transaction.status).toBe('waiting');

    expect(exchanger.depositTransaction).toEqual(transaction);
    expect(exchanger.depositTransaction.nonce).toBeGreaterThan(0);
});

test('createWithdraw', async () => {
    const emptyExchanger = new ChangeCoin();
    let withdraw = await emptyExchanger.createWithdraw();
    expect(withdraw).toBeFalsy();

    const wrongExchanger = new ChangeCoin({id: 1});
    withdraw = await wrongExchanger.createWithdraw();
    expect(withdraw).toBeFalsy();

    const alreadyCreatedExchanger = new ChangeCoin({id: 1, withdraw: {id: '123'}});
    withdraw = await alreadyCreatedExchanger.createWithdraw();
    expect(withdraw).not.toBeFalsy();
    expect(withdraw.id).toEqual('123');

    let inputTransaction = {
        id: 1,
        toCurrency: 'USDTTRC',
        toAddress: 'TKLyLojFPr6wRD22dYyTu5fc6NkMFYyfSC',
        deposit: {
            id: '123',
            memo: ''
        },
    }

    const exchanger = new ChangeCoin(inputTransaction);
    let transaction = await exchanger.createWithdraw();

    expect(transaction).not.toBeFalsy();
    expect(transaction.id).toBeGreaterThan(0);
    expect(transaction.status).toBe('wait');

    expect(exchanger.withdrawTransaction).toEqual(transaction);
    expect(exchanger.withdrawTransaction.nonce).toBeGreaterThan(0);
});

test('createTransaction', async () => {
    const exchanger = new ChangeCoin();
    let transaction = await exchanger.createTransaction();

    expect(transaction).toBeFalsy();

    let db = await getDb();
    exchanger.setDatabase( db );
    transaction = await exchanger.createTransaction(
        'RUB',
        'USDTTRC',
        'TUhDF7tMuVvwFobFrcyZnk7JxrYG6KQ4FC',
        {id: 1}
    );

    expect(transaction).not.toBeFalsy();
    expect(transaction.id).not.toBeFalsy();
    expect(transaction.fromCurrency).toEqual('RUB');
    expect(transaction.toCurrency).toEqual('USDTTRC');
    expect(transaction.toAddress).toEqual('TUhDF7tMuVvwFobFrcyZnk7JxrYG6KQ4FC');
    expect(transaction.created).toBeGreaterThan(0);
    expect(transaction.user.id).toEqual(1);
});

test('createReverseTransaction', async () => {
    const exchanger = new ChangeCoin();
    let transaction = await exchanger.createTransaction();

    expect(transaction).toBeFalsy();

    let db = await getDb();
    exchanger.setDatabase( db );

    transaction = await exchanger.createTransaction(
        'USDTTRC',
        'RUB',
        '5536913776872323',
        2,
        {id: 1}
    );

    expect(transaction).not.toBeFalsy();
    expect(transaction.id).not.toBeFalsy();
    expect(transaction.fromCurrency).toEqual('USDTTRC');
    expect(transaction.toCurrency).toEqual('RUB');
    expect(transaction.toAddress).toEqual('5536913776872323');
    expect(transaction.created).toBeGreaterThan(0);
    expect(transaction.user.id).toEqual(1);
});

test('process', async () => {
    let transactionId = "1f52b44e-500c-460e-9b06-9108116f63fd";

    let db = await getDb();
    let exchanger = new ChangeCoin();

    let transaction = await db.collection('transactions').findOne({id: transactionId});
    exchanger.setDatabase( db );
    exchanger.setTransaction(transaction);

    let finished = await exchanger.process();
});