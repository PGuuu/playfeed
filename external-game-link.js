(() => {
  function confirmDestination(event) {
    if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest('a[data-external-game][href]');
    if (!link) return;
    const url = new URL(link.href);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin === location.origin) return;
    if (!window.confirm('您現在正要前往外部網站：' + url.hostname + '\n\n要繼續開啟嗎？')) event.preventDefault();
  }

  document.addEventListener('click', confirmDestination);
  document.addEventListener('auxclick', confirmDestination);
})();
