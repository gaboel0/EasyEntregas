<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'
import FormField from './FormField.vue'
import { useConfirm } from '@/composables/useConfirm'

const { state, settle } = useConfirm()
const reason = ref('')
const touched = ref(false)

watch(
  () => state.open,
  (open) => {
    if (open) {
      reason.value = ''
      touched.value = false
    }
  },
)

const reasonError = computed(() =>
  state.reason?.required && touched.value && !reason.value.trim() ? 'Informe o motivo para continuar.' : undefined,
)

function confirm() {
  touched.value = true
  if (state.reason?.required && !reason.value.trim()) return
  settle(true, reason.value.trim())
}
</script>

<template>
  <AppModal elevated :open="state.open" :title="state.title" :description="state.reason ? state.description : undefined" size="sm" @close="settle(false)">
    <form v-if="state.reason" id="confirm-form" @submit.prevent="confirm">
      <FormField v-slot="{ id, invalid, describedby }" :label="state.reason.label" :required="state.reason.required" :error="reasonError">
        <textarea
          :id="id"
          v-model="reason"
          rows="3"
          autofocus
          class="field-input resize-none"
          :placeholder="state.reason.placeholder"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedby"
          maxlength="300"
        />
      </FormField>
    </form>
    <p v-else class="text-sm text-slate-600">{{ state.description ?? 'Confirme para continuar.' }}</p>
    <template #footer>
      <AppButton @click="settle(false)">{{ state.cancelLabel ?? 'Voltar' }}</AppButton>
      <AppButton :variant="state.tone === 'danger' ? 'danger' : 'primary'" :autofocus="!state.reason" @click="confirm">
        {{ state.confirmLabel ?? 'Confirmar' }}
      </AppButton>
    </template>
  </AppModal>
</template>
