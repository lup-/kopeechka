import Vue from 'vue';
import VueRouter from 'vue-router';

import Home from "../components/Home";
import TransactionsList from "../components/Transactions/List";
import Login from '../components/Users/Login';
import UsersEdit from '../components/Users/Edit';
import UsersList from '../components/Users/List';

import MailingsList from "@/components/Mailings/List";
import MailingEdit from "@/components/Mailings/Edit";
import BotsEdit from '@/components/Bots/Edit';
import BotsList from '@/components/Bots/List';
import Stats from "@/components/Stats/Stats";
import Details from "@/components/Stats/Details";

import store from "../store";

Vue.use(VueRouter);

const routes = [
    { name: 'home', path: '/', component: Home, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', component: Login },
    { name: 'transactionsList', path: '/transactions/', component: TransactionsList, meta: {requiresAuth: true, group: 'transactionsList'} },
    { name: 'usersList', path: '/users/', component: UsersList, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userNew', path: '/users/new', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/users/:id', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },

    { name: 'mailingsList', path: '/mailings/', component: MailingsList, meta: {requiresAuth: true, group: 'mailingsList'} },
    { name: 'mailingNew', path: '/mailings/new', component: MailingEdit, meta: {requiresAuth: true, group: 'mailingsList'} },
    { name: 'mailingEdit', path: '/mailings/:id', component: MailingEdit, meta: {requiresAuth: true, group: 'mailingsList'} },
    { name: 'botsList', path: '/bots/', component: BotsList, meta: {requiresAuth: true, group: 'botsList'} },
    { name: 'botNew', path: '/bots/new', component: BotsEdit, meta: {requiresAuth: true, group: 'botsList'} },
    { name: 'botEdit', path: '/bots/:id', component: BotsEdit, meta: {requiresAuth: true, group: 'botsList'} },
    { name: 'stats', path: '/stat/all', component: Stats, meta: {requiresAuth: true, group: 'stats'} },
    { name: 'statsDetails', path: '/stat/:id?', component: Details, meta: {requiresAuth: true, group: 'stats'} },
]

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

router.beforeEach(async (to, from, next) => {
    if (to.matched.some(record => record.meta.requiresAuth)) {
        await store.dispatch('loginLocalUser');
        let isNotLoggedIn = !store.getters.isLoggedIn;
        let loginTo = {
            path: '/login',
            query: { redirect: to.fullPath }
        };

        if (isNotLoggedIn) {
            next(loginTo);
        }
        else {
            let routeGroup = to.matched && to.matched[0] ? to.matched[0].meta.group : false;

            if (routeGroup && store.getters.userHasRights(routeGroup)) {
                next();
            }
            else {
                store.commit('setErrorMessage', 'Не достаточно прав!');
                next(loginTo);
            }
        }
    }
    else {
        next();
    }
})

export {router, store};