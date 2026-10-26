<script setup lang="ts">
import { MapPinOff } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppButton from '@/components/ui/AppButton.vue'
</script>

<template>
  <div class="card">
    <EmptyState :icon="MapPinOff" title="Página não encontrada" description="O endereço acessado não existe ou foi movido.">
      <AppButton variant="primary" :to="{ name: 'dashboard' }">Ir para a visão geral</AppButton>
    </EmptyState>
  </div>
</template>
