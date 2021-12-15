const { Scenes } = require('telegraf');
const { BaseScene } = Scenes;
const { menu } = require('../lib/helpers');

module.exports = function () {
    const scene = new BaseScene('exchange');
    scene.command('/start', ctx => {
        ctx.scene.reset();
        ctx.scene.reenter();
    });

    scene.enter(async ctx => {
        let routes = await ctx.exchanger.getRoutes();
        ctx.scene.state.routes = routes;

        let buttons = routes.map(route => {
            let code = route.from+':'+route.to;
            let text = route.fromInfo.name + ' -> ' + route.toInfo.name;
            return  {code, text};
        });

        await ctx.reply(
            'Выберите направление обмена',
            menu(buttons, 1)
        )
    });

    scene.action(/.*?:.*?/,async ctx => {
        let routeCode = ctx.update.callback_query ? ctx.update.callback_query.data : null;
        if (!routeCode) {
            return ctx.scene.reenter();
        }

        let [fromCurrency, toCurrency] = routeCode.split(':');
        let route = ctx.scene.state.routes.find(route => route.from === fromCurrency && route.to === toCurrency);
        ctx.scene.state.route = route;

        let rate = route.rateInfo;
        let message = `${route.fromInfo.name} в ${route.toInfo.name}

Максимальная сумма для обмена: *${route.max} ${route.from}*\nКурс: ${rate.rate} ${rate.inCurrency}`;
        message = message
            .replace(/\./g, '\\.')
            .replace(/\-/g, '\\-');

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

        ctx.state.scene.textType = null;
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

        return ctx.scene.leave();
    });

    return scene;
}