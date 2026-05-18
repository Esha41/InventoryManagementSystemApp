
export function scrollShellContentToTop(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const host = document.getElementById('shell-main-scroll');
      if (host) {
        host.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  });
}
