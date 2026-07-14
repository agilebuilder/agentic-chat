import type { Preview } from '@storybook/react-vite'
import '@agentic-chat/react-ui/styles.css'
import '../stories/storybook.css'

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    options: { storySort: { order: ['P2 Quality'] } },
  },
}

export default preview
