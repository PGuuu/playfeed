(() => {
 'use strict';
 const style=document.createElement('style');
 style.textContent=`*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}input,textarea,[contenteditable]:not([contenteditable="false"]),[contenteditable]:not([contenteditable="false"]) *{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default}`;
 document.head.append(style);
 const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 for(const type of ['selectstart','contextmenu'])document.addEventListener(type,event=>{if(!editable(event.target))event.preventDefault()},{capture:true});
 document.addEventListener('pointerdown',event=>{
  if(editable(event.target)||editable(document.activeElement))return;
  const selection=window.getSelection();if(selection?.rangeCount)selection.removeAllRanges();
 },{capture:true,passive:true});
 document.addEventListener('dragstart',event=>{
  if(!editable(event.target)&&event.target instanceof Element&&event.target.closest('img,svg,canvas,a')&&!event.target.closest('[draggable="true"]'))event.preventDefault();
 },{capture:true});
})();
