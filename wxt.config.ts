import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Simplest',
    description:
      'Autofill job applications, including the yes/no and "how did you hear about us" questions your profile does not cover.',
    permissions: ['storage', 'unlimitedStorage', 'activeTab', 'scripting'],
    host_permissions: ['https://api.openai.com/*', 'https://api.anthropic.com/*'],
    action: { default_title: 'Simplest' },
  },
});
