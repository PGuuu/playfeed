(()=>{window.PlayFeedAuth?.onChange(user=>{
 document.querySelector('#owner-analytics-link')?.remove();
 if(!['paulvongulla@gmail.com','paulwu.hs10@nycu.edu.tw'].includes(user?.email?.toLowerCase()))return;
 const a=document.createElement('a');a.id='owner-analytics-link';a.href='/analytics.html';a.textContent='流量統計與我的裝置';a.className='button';a.style.cssText='display:inline-block;margin:12px 0';
 (document.querySelector('.identity')||document.querySelector('main')||document.body).append(a);
});})();
