import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NumberInput from '@/components/ui/NumberInput.vue'

async function typeValue(value: string) {
  const wrapper = mount(NumberInput, { props: { modelValue: null } })
  await wrapper.get('input').setValue(value)
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0]
}

describe('NumberInput (formato brasileiro)', () => {
  it('aceita vírgula decimal', async () => {
    expect(await typeValue('6,19')).toBe(6.19)
  })

  it('entende ponto de milhar quando há vírgula', async () => {
    expect(await typeValue('1.234,5')).toBe(1234.5)
  })

  it('aceita ponto como decimal quando não há vírgula', async () => {
    expect(await typeValue('6.19')).toBe(6.19)
  })

  it('emite null para campo vazio', async () => {
    expect(await typeValue('')).toBeNull()
  })

  it('exibe o valor inicial com vírgula', () => {
    const wrapper = mount(NumberInput, { props: { modelValue: 7.5, prefix: 'R$' } })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('7,5')
    expect(wrapper.text()).toContain('R$')
  })
})
