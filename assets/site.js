/* 고슴이 홈페이지 공용 스크립트 — 앱 속 브라우저 안내 · 머리띠 · 나타나기 · 설치 안내 탭 · 붙박이 권유.
   추적·분석 코드는 없다. 이 파일은 아무것도 밖으로 보내지 않는다. */
(function(){
  "use strict";
  var d=document, ua=navigator.userAgent||"";
  d.documentElement.classList.remove("no-js");

  /* ── 앱 속 브라우저 (앱과 같은 판별식) ── */
  var INAPP=[[/KAKAOTALK/i,"카카오톡"],[/NAVER\(inapp/i,"네이버 앱"],[/Barcelona/i,"쓰레드"],[/Instagram/i,"인스타그램"],
    [/FBAN|FBAV|FB_IAB/i,"페이스북"],[/\bLine\//i,"라인"],[/BAND\//i,"밴드"],[/DaumApps/i,"다음 앱"],[/everytimeApp/i,"에브리타임"]];
  function standalone(){ try{ return !!(navigator.standalone||matchMedia("(display-mode: standalone)").matches); }catch(e){ return false; } }
  function inAppName(){
    if(standalone()) return "";
    for(var i=0;i<INAPP.length;i++) if(INAPP[i][0].test(ua)) return INAPP[i][1];
    if(/Android/i.test(ua)&&/; wv\)/.test(ua)) return "앱 속 브라우저";
    return "";
  }
  function outsideUrl(url){
    if(/KAKAOTALK/i.test(ua)) return "kakaotalk://web/openExternal?url="+encodeURIComponent(url);
    if(/\bLine\//i.test(ua)) return url+(url.indexOf("?")>=0?"&":"?")+"openExternalBrowser=1";
    if(/Android/i.test(ua)) return "intent://"+url.replace(/^https?:\/\//i,"")+"#Intent;scheme=https;package=com.android.chrome;end";
    return "";
  }
  var ios=/iPhone|iPad|iPod/i.test(ua), android=/Android/i.test(ua), inApp=inAppName();
  var ro=ios?"사파리로":"크롬으로";
  function openOutside(ev){
    if(ev) ev.preventDefault();
    var url=location.href.split("#")[0], go=outsideUrl(url);
    if(go){ location.href=go; return; }
    var done=function(){ alert("주소를 복사했어요.\n\n사파리를 열고 주소창에 붙여넣어 주세요.\n(또는 ··· 메뉴 → «Safari로 열기»)"); };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,function(){ prompt("이 주소를 복사해 사파리에 붙여넣어 주세요", url); });
    else prompt("이 주소를 복사해 사파리에 붙여넣어 주세요", url);
  }
  window.goseumiOpenOutside=openOutside;
  var bar=d.getElementById("inapp");
  if(bar&&inApp){
    bar.querySelector("[data-name]").textContent=inApp;
    var b=bar.querySelector("button"); b.textContent="🧭 "+ro+(outsideUrl("https://x/")?" 열기":" 여는 법");
    b.addEventListener("click",openOutside);
    bar.classList.add("on");
  }
  Array.prototype.forEach.call(d.querySelectorAll("[data-outside]"),function(el){
    el.textContent="🧭 "+ro+(outsideUrl("https://x/")?" 열기":" 여는 법"); el.addEventListener("click",openOutside);
  });

  /* ── 머리띠 선 ── */
  var hdr=d.querySelector("header.site");
  if(hdr){ var onS=function(){ hdr.classList.toggle("scrolled",scrollY>8); }; addEventListener("scroll",onS,{passive:true}); onS(); }

  /* ── 나타나기 ── */
  var rv=d.querySelectorAll(".reveal");
  if("IntersectionObserver" in window && rv.length){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }); },{rootMargin:"0px 0px -8% 0px",threshold:.08});
    Array.prototype.forEach.call(rv,function(el){ io.observe(el); });
  } else Array.prototype.forEach.call(rv,function(el){ el.classList.add("in"); });

  /* ── 설치 안내 탭 — 지금 기기에 맞는 칸을 먼저 연다 ── */
  var tabs=d.querySelectorAll('[role=tab]');
  function sel(id){ Array.prototype.forEach.call(tabs,function(t){ var on=t.getAttribute("aria-controls")===id; t.setAttribute("aria-selected",on?"true":"false"); t.tabIndex=on?0:-1;
    var p=d.getElementById(t.getAttribute("aria-controls")); if(p) p.hidden=!on; }); }
  if(tabs.length){
    Array.prototype.forEach.call(tabs,function(t,i){
      t.addEventListener("click",function(){ sel(t.getAttribute("aria-controls")); });
      t.addEventListener("keydown",function(e){ if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft") return; e.preventDefault();
        var n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length]; n.focus(); sel(n.getAttribute("aria-controls")); });
    });
    sel(inApp?"tp-inapp":ios?"tp-ios":android?"tp-and":"tp-ios");
  }

  /* ── 모바일 붙박이 권유 — 첫 화면의 단추가 안 보일 때만, 맨 끝 권유와 겹치지 않게 ── */
  var sc=d.getElementById("sticky-cta"), heroCta=d.getElementById("hero-cta"), endCta=d.getElementById("end-cta");
  if(sc&&heroCta&&"IntersectionObserver" in window){
    var heroVis=true, endVis=false;
    var upd=function(){ sc.classList.toggle("on",!heroVis&&!endVis); };
    new IntersectionObserver(function(es){ heroVis=es[0].isIntersecting; upd(); }).observe(heroCta);
    if(endCta) new IntersectionObserver(function(es){ endVis=es[0].isIntersecting; upd(); }).observe(endCta);
  }
})();
