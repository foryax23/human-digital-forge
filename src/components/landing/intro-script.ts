// Kept free of imports: the homepage route's head() pulls this into the entry
// chunk that every page loads.

export const STORAGE_KEY = "vortex-intro-seen";
export const STYLE_ID = "vortex-intro-style";

/** Hero elements carrying this attribute stay hidden until their entrance runs. */
export const HERO_REVEAL_ATTR = "data-hero-reveal";

export const INTRO_HEAD_SCRIPT = `(function(){try{
var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var seen=true;try{seen=sessionStorage.getItem('${STORAGE_KEY}')==='1'||!!location.hash;}catch(e){}
var hide='[${HERO_REVEAL_ATTR}]{opacity:0}';
var css=rm?'':hide;
if(!rm&&!seen)css+='.intro-loader{display:flex}';
var s=document.createElement('style');s.id='${STYLE_ID}';s.textContent=css;document.head.appendChild(s);
setTimeout(function(){s.textContent=s.textContent.replace(hide,'');},7000);
}catch(e){}})();`;
