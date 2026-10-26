<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Check, Minus, Pencil, ShieldCheck, UserPlus } from 'lucide-vue-next'
import type { Permission, User, UserRole } from '@/types/domain'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useZodForm } from '@/composables/useZodForm'
import { useToast } from '@/composables/useToast'
import { userInputSchema } from '@/modules/settings/settingsSchema'
import { PERMISSION_LABEL, ROLE_LABEL, ROLE_PERMISSIONS } from '@/modules/settings/permissions'
import { errorMessage } from '@/services'

const store = useSettingsStore()
const session = useSessionStore()
const toast = useToast()
const canManage = session.can('users.manage')
const { error, validate, reset } = useZodForm(userInputSchema)

const ROLES = Object.keys(ROLE_LABEL) as UserRole[]
const PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[]

const open = ref(false)
const editing = ref<User | null>(null)
const saving = ref(false)
const form = reactive({ name: '', email: '', role: 'attendant' as UserRole, active: true })

function openForm(user: User | null) {
  editing.value = user
  reset()
  Object.assign(form, user ? { name: user.name, email: user.email, role: user.role, active: user.active } : { name: '', email: '', role: 'attendant', active: true })
  open.value = true
}

async function submit() {
  const data = validate(form)
  if (!data) return
  saving.value = true
  try {
    await store.saveUser(data, editing.value?.id)
    toast.success(editing.value ? 'Usuário atualizado' : 'Usuário adicionado', data.name)
    open.value = false
  } catch (e) {
    toast.error('Não foi possível salvar o usuário', errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="card-title">Usuários do estabelecimento</h2>
        <AppButton v-if="canManage" size="sm" variant="primary" :icon="UserPlus" @click="openForm(null)">Adicionar usuário</AppButton>
      </div>
      <table class="table-base">
        <thead>
          <tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="u in store.users" :key="u.id">
            <td class="font-medium text-slate-900">{{ u.name }} <span v-if="u.id === session.user?.id" class="text-xs font-normal text-slate-400">(você)</span></td>
            <td class="text-slate-600">{{ u.email }}</td>
            <td class="text-slate-600">{{ ROLE_LABEL[u.role] }}</td>
            <td>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="u.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-zinc-100 text-zinc-500 ring-zinc-200'">
                {{ u.active ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="text-right">
              <AppButton v-if="canManage" size="sm" variant="ghost" :icon="Pencil" :title="`Editar ${u.name}`" @click="openForm(u)"><span class="sr-only">Editar</span></AppButton>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="flex gap-2 border-t border-slate-100 bg-slate-100/50 px-4 py-3 text-xs text-slate-600">
        <ShieldCheck :size="14" class="mt-0.5 shrink-0" aria-hidden="true" />
        Nesta versão os usuários servem para registrar quem fez cada alteração e simular perfis. Convites por e-mail, senhas e autenticação serão feitos pelo backend —
        o painel nunca armazena senhas.
      </p>
    </section>

    <section class="card overflow-hidden">
      <div class="card-header"><h2 class="card-title">Permissões por perfil</h2></div>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th scope="col">Permissão</th>
              <th v-for="r in ROLES" :key="r" scope="col" class="text-center">{{ ROLE_LABEL[r] }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in PERMISSIONS" :key="p">
              <td class="text-slate-700">{{ PERMISSION_LABEL[p] }}</td>
              <td v-for="r in ROLES" :key="r" class="text-center">
                <Check v-if="ROLE_PERMISSIONS[r].includes(p)" :size="15" class="mx-auto text-emerald-600" aria-label="permitido" />
                <Minus v-else :size="15" class="mx-auto text-slate-300" aria-label="não permitido" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :open="open" size="sm" :title="editing ? 'Editar usuário' : 'Adicionar usuário'" @close="open = false">
      <form id="user-form" novalidate class="space-y-4" @submit.prevent="submit">
        <FormField v-slot="{ id, invalid }" label="Nome" required :error="error('name')">
          <input :id="id" v-model="form.name" class="field-input" autofocus :aria-invalid="invalid || undefined" />
        </FormField>
        <FormField v-slot="{ id, invalid }" label="E-mail" required :error="error('email')">
          <input :id="id" v-model="form.email" type="email" class="field-input" :aria-invalid="invalid || undefined" />
        </FormField>
        <FormField v-slot="{ id }" label="Perfil de acesso">
          <select :id="id" v-model="form.role" class="field-input">
            <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
          </select>
        </FormField>
        <AppSwitch v-model="form.active" label="Usuário ativo" />
      </form>
      <template #footer>
        <AppButton @click="open = false">Cancelar</AppButton>
        <AppButton type="submit" form="user-form" variant="primary" :loading="saving">Salvar</AppButton>
      </template>
    </AppModal>
  </div>
</template>
