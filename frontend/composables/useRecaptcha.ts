declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export function useRecaptcha() {
  const { public: { recaptchaSiteKey } } = useRuntimeConfig();

  function loadScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('recaptcha-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  async function execute(action: string): Promise<string> {
    await loadScript();
    return new Promise((resolve) => {
      window.grecaptcha.ready(async () => {
        const token = await window.grecaptcha.execute(recaptchaSiteKey as string, { action });
        resolve(token);
      });
    });
  }

  return { execute };
}
