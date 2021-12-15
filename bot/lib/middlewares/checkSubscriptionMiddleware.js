const {getDb} = require('../database');
const { Telegraf } = require('telegraf');
const BOT_TOKEN = process.env.BOT_TOKEN;

const MAX_WAIT_TIMEOUT_SEC = 5 * 60;

function hasSubscriberStatus(subscriber) {
    return subscriber && subscriber.status && ["creator", "administrator", "member"].indexOf(subscriber.status) !== -1;
}

async function checkSubscribe(tg, chat, userId) {
    let isSubscriber = false;

    if (chat instanceof Array) {
        isSubscriber = true;
        for (let oneChat of chat) {
            let isChatSubscriber = false;
            try {
                let subscriber = await tg.getChatMember(oneChat, userId);
                isChatSubscriber = hasSubscriberStatus(subscriber);
            }
            catch (e) {
                isChatSubscriber = false;
            }

            isSubscriber = isSubscriber && isChatSubscriber;
        }

    }
    else {
        let subscriber = await tg.getChatMember(chat, userId);
        isSubscriber = hasSubscriberStatus(subscriber);
    }

    return isSubscriber;
}

async function waitForSubscription(tg, chat, userId) {
    let timeout = MAX_WAIT_TIMEOUT_SEC * 1000;
    let checkStepTime = 1000;

    return new Promise(resolve => {
        let checkIntervalId;
        let doCheck = async () => {
            let isSubscriber = await checkSubscribe(tg, chat, userId);
            if (isSubscriber) {
                clearInterval(checkIntervalId);
                resolve(isSubscriber);
            }
        };

        checkIntervalId = setInterval(doCheck, checkStepTime);
        doCheck();

        setTimeout(async () => {
            clearInterval(checkIntervalId);
            let isSubscriber = await checkSubscribe(tg, chat, userId);
            resolve(isSubscriber);
        }, timeout);
    });
}

module.exports = async (ctx, next, bot) => {
    let skipThisUpdate = ctx.chat.type !== 'private';
    if (skipThisUpdate) {
        return next();
    }

    if (ctx && ctx.session && ctx.session.delaySubscribeCheck) {
        return next();
    }

    if (ctx && ctx.session && ctx.session.subscribtionSuccess) {
        return next();
    }

    let needsSubscription = bot && bot.needsSubscription && bot.needsSubscription.length > 0;

    if (needsSubscription) {
        let chatUsername = bot.needsSubscription;
        let userId = ctx.from ? ctx.from.id : false;

        let isSubscriber = false;

        if (userId) {
            isSubscriber = await checkSubscribe(ctx.tg, chatUsername, userId);
        }

        if (!isSubscriber) {
            let chatId = ctx.chat.id;
            let tg = new Telegraf(bot.token).telegram;

            setTimeout(async () => {
                try {
                    let chatsText = chatUsername instanceof Array
                        ? chatUsername.join(', ')
                        : chatUsername;
                    await tg.sendMessage(chatId,'Сначала необходимо подписаться на '+chatsText);
                    isSubscriber = await waitForSubscription(tg, chatUsername, userId);
                    if (isSubscriber) {
                        //await tg.sendMessage(chatId,'Спасибо, что подписались! Повторите последнее действие, пожалуйста');
                        return next();
                    }
                }
                catch (e) {
                    console.log('Subscribe '+e );
                }
            }, 0);
            return;
        }
    }

    if (ctx.session) {
        ctx.session.subscribtionSuccess = true;
    }

    return next();
}