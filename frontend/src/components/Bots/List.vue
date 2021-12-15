<template>
    <v-container class="fill-height align-start">
        <v-row :align="isEmpty || isLoading ? 'center' : 'start'" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-btn fab bottom right fixed large color="primary"
                    @click="gotoNew"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>
            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="items"
                        :loading="isLoading"
                        :items-per-page="50"
                        multi-sort
                        :sort-by="['created']"
                        :sort-desc="[true]"
                        locale="ru"
                >
                    <template v-slot:item.username="{ item }">
                        @{{item.username}} <v-btn text small :href="`https://t.me/${item.username}`" target="_blank"><v-icon>mdi-open-in-new</v-icon></v-btn>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
                        <v-btn icon small @click="restartBot(item)"><v-icon>mdi-restart-alert</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import CrudList from "@/components/CrudList";

    export default {
        extends: CrudList,
        data() {
            return {
                isLoading: false,
                headers: [
                    {text: 'Имя', value: 'username'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ],

                ACTION_LOAD: 'bot/loadItems',
                ACTION_DELETE: 'bot/deleteItem',
                ROUTE_EDIT: 'botEdit',
                ROUTE_NEW: 'botNew',
                STORE_MODULE: 'bot'
            }
        },
        async mounted() {
            await this.loadItems();
        },
        methods: {
            async loadItems() {
                this.isLoading = true;
                await this.$store.dispatch(this.ACTION_LOAD);
                this.isLoading = false;
            },
            async restartBot(bot) {
                await this.$store.dispatch('bot/restartBot', bot);
            }
        }
    }
</script>
