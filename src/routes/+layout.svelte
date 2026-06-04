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
          console.log('SW Registered:', r);
        },
        onRegisterError(error: Error) {
          console.log('SW registration error', error);
        }
      });
    }
  });
</script>

<svelte:head>
  {@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
</svelte:head>

{@render children()}
