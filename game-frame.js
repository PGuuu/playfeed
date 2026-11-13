(() => {
 function configure(frame, value, base = location.origin + '/') {
  const url = new URL(value, base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('遊戲網址無效。');
  // A remote game keeps its own origin for modules and storage. Same-origin
  // platform pages stay isolated so embedded scripts cannot access the parent.
  const remote = url.origin !== new URL(base).origin;
  frame.setAttribute('sandbox', remote ? 'allow-scripts allow-same-origin allow-forms allow-pointer-lock' : 'allow-scripts');
  frame.setAttribute('allow', 'fullscreen');
  frame.referrerPolicy = 'no-referrer';
  return url.href;
 }
 window.PlayFeedFrame = { configure };
})();
