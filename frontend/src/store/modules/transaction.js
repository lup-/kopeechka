import axios from "axios";

export default {
    state: {
        list: [],
        currentFilter: false,
    },
    actions: {
        async loadTransactions({commit}, filter = {}) {
            let response = await axios.post(`/api/transaction/list`, {filter});
            await commit('setFilter', filter);
            return commit('setPayments', response.data.transactions);
        },
    },
    mutations: {
        setPayments(state, transactions) {
            state.list = transactions;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        }
    }
}