import Vue from 'vue';
import Vuex from 'vuex';

import user from "./modules/user";
import transaction from "./modules/transaction";
import mailing from "./modules/mailing";
import bot from "./modules/bot";
import stats from "@/store/modules/stats";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        appError: false,
        appMessage: false,
        loading: false,
        routes: [
            {code: 'mailingsList', title: 'Рассылки', icon: 'mdi-email'},
            {code: 'botsList', title: 'Боты', icon: 'mdi-robot'},
            {code: 'stats', title: 'Статистика', icon: 'mdi-database'},
            {code: 'transactionsList', title: 'Транзакции', icon: 'mdi-cash'},
            {code: 'usersList', title: 'Пользователи админки', icon: 'mdi-account'},
        ],
        showChatsList: true,
    },
    getters: {
        allowedRoutes(state, getters) {
            return state.routes.filter(route => getters.userHasRights(route.code));
        }
    },
    mutations: {
        setLoading(state, newLoadingState) {
            state.loading = newLoadingState;
        },
        setAppError(state, error) {
            state.appError = error;
        },
        setErrorMessage(state, text) {
            state.appMessage = {text, color: 'error'};
        },
        setSuccessMessage(state, text) {
            state.appMessage = {text, color: 'success'};
        },
        setInfoMessage(state, text) {
            state.appMessage = {text, color: 'info'};
        },
    },
    actions: {},
    modules: {
        user,
        transaction,
        mailing,
        bot,
        stats
    }
})
