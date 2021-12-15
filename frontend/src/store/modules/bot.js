import Crud from "./baseCrud";
import axios from "axios";

const API_LIST_URL = `/api/bots/list`;
const API_ADD_URL = `/api/bots/add`;
const API_UPDATE_URL = `/api/bots/update`;
const API_DELETE_URL = `/api/bots/delete`;

const NAME_ITEMS = 'bots';
const NAME_ITEM = 'bot';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
}, {
    getters: {
        botNames(state) {
            return state.list.map(bot => bot.botName);
        },
        botTgField(state) {
            return (botId, field) => {
                let bot = state.list.find(bot => bot.id === botId);
                return bot && bot.tg ? bot.tg[field] || false : false;
            }
        },
        allowedBotList(state, getters, rootState) {
            let currentUser = rootState.user.current;
            let allowedBots = currentUser.botRights || [];
            let anyBotAllowed = allowedBots.length === 0;

            return state.list.filter(bot => {
                return anyBotAllowed || allowedBots.indexOf(bot.botName) !== -1;
            });
        },
        allowedBotListForSelect(state, getters) {
            return getters.allowedBotList.map(bot => {
                return {text: bot.username, value: bot.id};
            });
        },
        allowedBotNames(state, getters) {
            return getters.allowedBotList.map(bot => bot.username);
        },
        allowedBotIds(state, getters) {
            return getters.allowedBotList.map(bot => bot.id);
        },
        allowedBotFilter(state, getters) {
            return (botPropName, filterSingle = false, allowAll = false) => {
                let filter = {};
                let allowedBots = getters.allowedBotIds.slice();
                if (allowAll) {
                    allowedBots.push(false);
                    allowedBots.push(null);
                }

                if (allowedBots.length > 0) {
                    filter[botPropName] = filterSingle
                        ? {$in: allowedBots, $size: 1}
                        : {$in: allowedBots};
                }

                return filter;
            }
        },
        botById(state) {
            return (botId) => {
                return state.list.find(bot => bot.id === botId);
            }
        }
    },
    actions: {
        async restartBot({commit}, bot) {
            let {data} = await axios.post(`/api/bots/restart`, {bot});
            if (data && data.bot && data.bot.username === bot.username) {
                commit('setSuccessMessage', 'Бот перезапущен!', { root: true });
            }
            else {
                let error = data.error ? data.error.message || '<данных об ошибке нет>' : '<данных об ошибке нет>';
                commit('setErrorMessage', `Ошибка перезагрузки бота: ${error}!`, { root: true });
            }
            return data;
        },
    }
});