import { createRendererRegistry, type ResultRendererProps } from '@agentic-chat/react'

function WeatherResult({ content }: ResultRendererProps) {
  if (content.kind !== 'example.weather') return null
  const value = content.value as { city: string; temperature: number }
  return <section aria-label={`Weather for ${value.city}`}><strong>{value.city}</strong><span>{value.temperature}°C</span></section>
}

export const rendererRegistry = createRendererRegistry()
rendererRegistry.result('example.weather', WeatherResult)
