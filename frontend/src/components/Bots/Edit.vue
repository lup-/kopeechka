<template>
  <v-container class="fill-height align-start">
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>{{ isNew ? 'Новый бот' : 'Редактирование бота' }}</v-card-title>
          <v-card-text>
            <v-form autocomplete="off">

              <v-row class="mt-4">
                <v-col cols="12">
                  <v-text-field
                      v-model="item.token"
                      label="Токен бота"
                      outlined
                  ></v-text-field>

                  <v-text-field
                      v-model="item.apiKey"
                      label="Ключ API"
                      outlined
                  ></v-text-field>

                  <v-textarea
                      v-model="item.secretKey"
                      label="Секретный ключ"
                      outlined
                  ></v-textarea>
                </v-col>
              </v-row>

              <v-combobox v-model="item.needsSubscription"
                          label="Требовать подписку"
                          multiple
                          chips
                          deletable-chips
                          hint="Например: @vcblr"
                          outlined
                          persistent-hint
              ></v-combobox>

              <v-textarea
                  v-model="item.introMessage"
                  class="mt-4"
                  label="Приветственное сообщение"
                  outlined
              ></v-textarea>

              <v-text-field
                  v-model="item.supportContacts"
                  label="Контакты техподдержки"
                  hint="Например: @reflexum"
                  persistent-hint
                  outlined
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="gotoList">К списку</v-btn>
            <v-btn large color="primary" @click="save">Сохранить</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import CrudEdit from '@/components/CrudEdit';

export default {
  extends: CrudEdit,
  data() {
    return {
      item: {},

      ACTION_LOAD: 'bot/loadItems',
      ACTION_NEW: 'bot/newItem',
      ACTION_SAVE: 'bot/saveItem',
      ACTION_SET_EDIT_ITEM: 'bot/setEditItem',
      ROUTE_LIST: 'botsList',
      STORE_MODULE: 'bot'
    }
  },
  methods: {},
  computed: {}
}
</script>

<style scoped>

</style>