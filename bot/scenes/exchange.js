const { Scenes } = require('telegraf');
const { BaseScene } = Scenes;
const { menu } = require('../lib/helpers');

function getRouteName(route, isToRoute) {
    let name = isToRoute
        ? route.toInfo.name
        : route.fromInfo.name;

    let currencyCode = isToRoute
        ? route.to
        : route.from;

    let needToAddRub = currencyCode.indexOf('RUB') !== -1 && currencyCode !== 'RUB';
    if (needToAddRub) {
        name = name + ' (RUB)';
    }

    let needToAddUah = currencyCode.indexOf('UAH') !== -1 && currencyCode !== 'UAH';
    if (needToAddUah) {
        name = name + ' (UAH)';
    }

    return name;
}
function allowedCurrency(route) {
    let isNotDuplicatedRubRoute = route.to !== 'RUB' && route.from !== 'RUB';
    let isNotDuplicatedUahRoute = route.to !== 'UAH' && route.from !== 'UAH';
    return  isNotDuplicatedRubRoute && isNotDuplicatedUahRoute;
}
function isFiatCurrency(code) {
    return /(RUB|UAH)$/.test(code) || code === 'USD';
}

module.exports = function () {
    const scene = new BaseScene('exchange');
    scene.command('/start', ctx => {
        ctx.scene.reset();
        ctx.scene.reenter();
    });

    scene.enter(async ctx => {
        let routes = await ctx.exchanger.getRoutes();
        ctx.scene.state.routes = routes;

        let toRoutes = routes
            .filter(allowedCurrency)
            .reduce((hash, route) => {
                hash[route.to] = getRouteName(route, true);
                return hash;
            }, {});

        let buttons = Object.keys(toRoutes)
            .map(routeCode => {
                let code = 'to:'+routeCode;
                let text = toRoutes[routeCode];
                return  {code, text};
            });

        await ctx.reply(
            'Какую валюту хотите получить?',
            menu(buttons, 1)
        );
    });

    scene.action(/to:.*?/,async ctx => {
        let routeCode = ctx.update.callback_query ? ctx.update.callback_query.data : null;
        if (!routeCode) {
            return ctx.scene.reenter();
        }

        let [, toCurrency] = routeCode.split(':');
        let isToFiat = isFiatCurrency(toCurrency);
        ctx.scene.state.toCurrency = toCurrency;

        let routes = ctx.scene.state.routes;

        let fromRoutes = routes
            .filter(allowedCurrency)
            .filter(route => route.from !== toCurrency)
            .filter(route => {
                return isToFiat
                    ? isFiatCurrency(route.from) !== isToFiat
                    : true;
            })
            .reduce((hash, route) => {
                hash[route.from] = getRouteName(route, false);
                return hash;
            }, {});

        let buttons = Object.keys(fromRoutes)
            .map(routeCode => {
                let code = 'from:'+routeCode;
                let text = fromRoutes[routeCode];
                return  {code, text};
            });

        await ctx.reply(
            'Какую валюту отдаете?',
            menu(buttons, 1)
        );
    });

    scene.action(/from:.*?/,async ctx => {
        let routeCode = ctx.update.callback_query ? ctx.update.callback_query.data : null;
        if (!routeCode) {
            return ctx.scene.reenter();
        }

        let [, fromCurrency] = routeCode.split(':');
        let toCurrency = ctx.scene.state.toCurrency;

        let route = ctx.scene.state.routes.find(route => route.from === fromCurrency && route.to === toCurrency);
        ctx.scene.state.route = route;

        let rate = route.rateInfo;
        let message = `${getRouteName(route, false)} в ${getRouteName(route, true)}

Максимальная сумма для обмена: *${route.max} ${route.from}*\nКурс: ${rate.rate} ${rate.inCurrency}`;
        message = message
            .replace(/\./g, '\\.')
            .replace(/\-/g, '\\-')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');

        await ctx.replyWithMarkdownV2(
            message,
            menu([
                {code: 'route_yes', text: 'Начнем'},
                {code: 'route_no', text: 'Отмена'}
            ])
        );
    });

    scene.action(/route_(yes|no)/,async ctx => {
        let reply = ctx.update.callback_query.data.replace('route_', '');
        let route = ctx.scene.state.route;

        let restart = reply !== 'yes';
        if (restart) {
            return ctx.scene.reenter();
        }

        let toFiat = route.to.indexOf('RUB') !== -1 ||
            route.to.indexOf('UAH') !== -1 ||
            route.to === 'USD';
        ctx.scene.state.toFiat = toFiat;
        ctx.scene.state.textType = 'toAddress';

        let message = toFiat
            ? 'Пришлите номер вашей карты, куда должен поступить перевод'
            : 'Пришлите номер кошелька, куда должен поступить перевод';

        await ctx.reply(message);
    });

    scene.on('text', async ctx => {
        if (ctx.scene.state.textType === 'toAddress') {
            let route = ctx.scene.state.route;
            let toAddress = ctx.message && ctx.message.text ? ctx.message.text : false;

            if (toAddress) {
                ctx.scene.state.toAddress = toAddress;
                ctx.scene.state.textType = 'amount';
                return ctx.reply(`Пришлите сумму для обмена.\nМаксимальная сумма: ${route.max} ${route.from}`);
            }
            else {
                return ctx.reply('Неправильный адрес, укажите еще раз');
            }
        }
        else if (ctx.scene.state.textType === 'amount') {
            let route = ctx.scene.state.route;
            let amount = ctx.message && ctx.message.text ? parseFloat(ctx.message.text) || false : false;
            if (amount > 0 && amount < route.max) {
                ctx.scene.state.amount = amount;

                let route = ctx.scene.state.route;
                let rate = route.rateInfo;
                let result = amount * rate.multiplier;
                let toFiat = ctx.scene.state.toFiat;
                let toAddress = ctx.scene.state.toAddress;

                let message = `Из: ${route.fromInfo.name}
В: ${route.toInfo.name}
По курсу: ${rate.rate} ${rate.inCurrency}
Сумма: ${amount} ${route.from}

Вы получите: ${result} ${route.to}
На ${toFiat ? 'карту' : 'кошелек'}: ${toAddress}

Комиссия будет удержана из суммы платежа
Курс может меняться во время обмена`

                await ctx.reply(
                    message,
                    menu([
                        {code: 'final_yes', text: 'Поехали'},
                        {code: 'final_no', text: 'Отмена'}
                    ])
                );
            }
            else {
                return ctx.reply('Неправильная сумма платежа, укажите еще раз');
            }
        }

        ctx.scene.state.textType = null;
    });

    scene.action(/final_(yes|no)/,async ctx => {
        let reply = ctx.update.callback_query ? ctx.update.callback_query.data.replace('final_', '') : null;

        let restart = reply !== 'yes';
        if (restart) {
            return ctx.scene.reenter();
        }

        let route = ctx.scene.state.route;
        let transaction = await ctx.exchanger.createTransaction(
            route.from,
            route.to,
            ctx.scene.state.toAddress,
            ctx.scene.state.amount,
            ctx.from,
            ctx.bot
        );

        if (transaction) {
            await ctx.reply(`${transaction.id}\nЗапущен процесс обмена валют`);
        }
        else {
            await ctx.reply(`Ошибка запуска обмена\n${ctx.exchanger.lastError}`);
        }

        return ctx.scene.leave();
    });

    return scene;
}