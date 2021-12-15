<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="tableHeaders"
                        :items="tableData"
                        :loading="isLoading"
                        :single-expand="false"
                        :expanded.sync="expanded"
                        :items-per-page="50"
                        item-key="botId"
                        show-expand
                >
                    <template v-slot:expanded-item="{ headers, item }">
                        <td class="d-none d-md-table-cell"></td>
                        <td class="d-none d-md-table-cell pr-0" colspan="2">
                            <table class="expand-table">
                                <tr v-for="(ref, index) in item.refs" :key="ref.code" :style="{backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)'}">
                                    <td>{{ref.code}}</td>
                                </tr>
                            </table>
                        </td>
                        <td class="d-none d-md-table-cell px-0" colspan="2">
                            <table class="expand-table">
                                <tr v-for="(ref, index) in item.refs" :key="ref.code" :style="{backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)'}">
                                    <td class="pl-4">{{ref.count || 0}}</td>
                                </tr>
                            </table>
                        </td>
                        <td class="d-none d-md-table-cell"></td>

                        <td class="d-md-none pr-0">
                            <table class="expand-table">
                                <tr v-for="(ref, index) in item.refs" :key="ref.code" :style="{backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)'}">
                                    <td>{{ref.code}}</td>
                                    <td class="pl-4">{{ref.count || 0}}</td>
                                </tr>
                            </table>
                        </td>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <v-btn small icon @click="gotoBotStats(item.botId)"><v-icon>mdi-chart-bar</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "Stats",
        data() {
            return {
                isLoading: false,
                expanded: [],
            }
        },
        async mounted() {
            await this.loadStats();
        },
        methods: {
            async loadStats() {
                this.isLoading = true;
                let filter = this.$store.getters['bot/allowedBotFilter']('id');
                await this.$store.dispatch('loadStats', filter);
                this.isLoading = false;
            },
            gotoBotStats(botId) {
                this.$router.push({name: 'statsDetails', params: {id: botId}});
            },
            gotoSettings(botName) {
                this.$router.push({name: 'botSettings', params: {botName}});
            }
        },
        computed: {
            stats() {
                return this.isLoading ? [] : this.$store.state.stats.stats;
            },
            isEmpty() {
                return this.stats.length === 0 && this.isLoading === false;
            },
            tableHeaders() {
                return [
                    {text: 'Код бода', value: 'botId'},
                    {text: 'Подключено к', value: 'userName'},
                    {text: 'Пользователи', value: 'count'},
                    {text: 'Живых', value: 'alive'},
                    {text: 'Блокировок', value: 'blocked'},
                    {text: 'Внешний', value: 'external'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            },
            tableData() {
                return this.stats.map(stat => {
                    return {
                        botId: stat.botId,
                        userName: stat.userName,
                        count: stat.users.count,
                        alive: stat.alive.count,
                        blocked: stat.blocked.count,
                        refs: stat.refs,
                    }
                });
            }
        }
    }
</script>

<style>
    .expand-table {width: 100%; border-collapse: collapse;}
</style>