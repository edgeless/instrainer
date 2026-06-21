<script lang="ts">
  import '../app.css';
  import { pwaInfo } from 'virtual:pwa-info';
  import { onMount } from 'svelte';
  let { children } = $props();

  onMount(async () => {
    if (pwaInfo) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onRegistered(r: ServiceWorkerRegistration | undefined) {
          // SW registered successfully
        },
        onRegisterError(error: Error) {
          console.error('SW registration error', error);
        }
      });
    }
  });
</script>

<svelte:head>
  {@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
</svelte:head>

{@render children()}
