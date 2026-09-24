/* 랜딩 «생일 넣고 미리 보기» — 입력한 날짜는 이 기기 밖으로 나가지 않는다(서버 없음, 전송 없음).
   «이 생일로 시작하기»를 누를 때만 같은 주소의 기기 저장소(localStorage)에 잠깐 넣어 앱 첫 화면에 채워 준다. */
(function(){
  "use strict";
  var form=document.getElementById("demo-form"), out=document.getElementById("demo-out");
  if(!form||!out) return;
  var input=form.querySelector("input[type=date]"), data=null, loading=null;
  var DOMS=["인지","신체","사회정서","언어"], LABEL={"인지":"인지","신체":"신체·운동","사회정서":"사회성·정서","언어":"언어·의사소통"};
  function pad(n){ return (n<10?"0":"")+n; }
  function today(){ var t=new Date(); return t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate()); }
  input.max=today();
  function load(){ if(data) return Promise.resolve(data); if(loading) return loading;
    loading=fetch(form.getAttribute("data-src")).then(function(r){ return r.json(); }).then(function(j){ data=j; return j; }); return loading; }
  input.addEventListener("focus",load,{once:true});
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function rich(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>"); }
  function age(b){ /* 달력 기준 만 개월 — 앱과 같다 */
    var B=new Date(b+"T00:00:00"), T=new Date(today()+"T00:00:00");
    var mo=(T.getFullYear()-B.getFullYear())*12+(T.getMonth()-B.getMonth()), a=new Date(B); a.setMonth(B.getMonth()+mo);
    if(a>T){ mo--; a=new Date(B); a.setMonth(B.getMonth()+mo); }
    return {m:mo, d:Math.round((T-a)/864e5)};
  }
  function hash(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return Math.abs(h); }
  function pick(plays,M){
    var t=today(), res=[];
    DOMS.forEach(function(dm){
      for(var m=M;m>=0;m--){ var L=plays.filter(function(p){ return p.m===m&&p.dom===dm; });
        if(L.length){ res.push(L[hash(t+dm)%L.length]); break; } }
    });
    return res;
  }
  form.addEventListener("submit",function(e){
    e.preventDefault();
    var b=input.value;
    if(!b){ input.focus(); return; }
    if(b>today()){ out.innerHTML='<div class="demo-empty"><p>아직 오지 않은 날짜예요. 생일을 다시 확인해 주세요.</p></div>'; return; }
    out.innerHTML='<div class="demo-empty"><p>놀이를 고르는 중…</p></div>';
    load().then(function(j){
      var A=age(b), M=Math.min(A.m,j.maxM), list=pick(j.plays,M);
      /* 9개월부터는 구간 놀이(to) — 지금 달이 들어 있는 구간의 시작 달 페이지로 */
      var start=Math.max.apply(null,j.plays.filter(function(p){ return p.m<=M; }).map(function(p){ return p.m; }));
      var end=Math.max.apply(null,j.plays.filter(function(p){ return p.m===start; }).map(function(p){ return p.to==null?p.m:p.to; }));
      var rng=(end>start?start+"~"+end:start)+"개월";
      var h='<p class="demo-age">생후 '+A.m+'개월 '+A.d+'일 — 오늘 해볼 놀이</p>';
      if(A.m>j.maxM) h+='<p class="small">놀이는 지금 <b>생후 '+j.maxM+'개월까지</b> 있어요. 아래는 '+rng+' 놀이예요. 잠·이유식·기록은 개월수와 상관없이 쓸 수 있어요.</p>';
      else h+='<p class="small">인지·신체·사회성·언어에서 하나씩. 다 할 필요 없어요 — 끌리는 하나면 충분해요.</p>';
      h+='<div class="demo-grid">';
      list.forEach(function(p){
        h+='<article class="dplay"><span class="tag t-'+p.dom+'">'+LABEL[p.dom]+'</span><h3>'+esc(p.name)+'</h3><p>'+rich(p.how)+'</p>'
          +(p.mat?'<p class="mat">준비물 · '+esc(p.mat)+'</p>':'')+'</article>';
      });
      h+='</div><div class="demo-cta"><a class="btn btn-pri btn-lg" href="'+form.getAttribute("data-app")+'" id="demo-go">이 생일로 고슴이 시작하기 →</a>'
        +'<a class="btn btn-sec" href="'+form.getAttribute("data-month")+start+'.html">'+(start===0?'신생아':'생후 '+rng)+' 놀이 전부 보기</a></div>';
      out.innerHTML=h;
      document.getElementById("demo-go").addEventListener("click",function(){
        try{ localStorage.setItem("siwoo.prefill",JSON.stringify({birth:b})); }catch(_){}
      });
      out.focus({preventScroll:true});
    }).catch(function(){ out.innerHTML='<div class="demo-empty"><p>놀이를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</p></div>'; });
  });
})();
