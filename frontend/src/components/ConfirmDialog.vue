<script setup>
defineProps({
  modelValue: Boolean,
  title: String,
  description: String,
  busy: Boolean,
  error: String,
  label: { type: String, default: 'Confirm' }
})
defineEmits(['update:modelValue', 'confirm'])
</script>
<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="busy"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="dialog-card"
      ><q-card-section
        ><h2 class="dialog-title">{{ title }}</h2
        ><p class="text-muted q-mt-md">{{ description }}</p
        ><p v-if="error" role="alert" class="error-banner">{{
          error
        }}</p></q-card-section
      ><q-card-actions align="right" class="q-pa-md"
        ><q-btn flat label="Keep channel" :disable="busy" v-close-popup /><q-btn
          unelevated
          color="negative"
          :label="label"
          :loading="busy"
          @click="$emit('confirm')" /></q-card-actions
    ></q-card>
  </q-dialog>
</template>
