# 產生 site/concepts.html：在手機上預覽概念清單（含組合圖示）
import csv, json, html
rows = list(csv.DictReader(open('concepts-a1.csv', encoding='utf-8')))
primes = list(csv.DictReader(open('nsm-primes.csv', encoding='utf-8')))
pdata = json.dumps(primes, ensure_ascii=False)
need = open('concepts-a1-need-icon.txt', encoding='utf-8').read().split()
data = json.dumps(rows, ensure_ascii=False)
TPL = {'single': '單一', 'place': '場所＋用途', 'role': '人＋工作', 'action': '動作 A→B', 'contrast': '對比'}
page = f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>基礎單字集</title>
<style>
body{{margin:0;font-family:system-ui,-apple-system,"PingFang TC",sans-serif;background:#10304a;color:#fbf6ea}}
main{{max-width:720px;margin:0 auto;padding:16px}}
h1{{font-size:20px;margin:4px 0}} .muted{{color:#b7bddc;font-size:13px;line-height:1.5}}
.bar{{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}} .bar button{{border:0;border-radius:99px;padding:6px 12px;background:#0006;color:inherit;font-weight:700;font-size:13px}}
.bar button.on{{background:#ffcf4a;color:#2a2440}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}}
.c{{background:#0000003a;border:2px solid #ffffff1f;border-radius:14px;padding:8px 6px;text-align:center;cursor:pointer}}
.c.B{{border-style:dashed}} .c.C{{border-style:dotted;opacity:.8}} .todo{{font-size:13px;color:#b7bddc}} .ja{{font-size:12px;color:#ffcf4a}} .w{{font-weight:800;font-size:13px;margin-top:4px}} .g{{font-size:11px;color:#b7bddc}}
.ic{{height:52px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:36px;line-height:1}}
.combo{{position:relative;display:inline-block;font-size:40px}} .combo small{{position:absolute;right:-12px;bottom:-6px;font-size:22px;background:#fff8e8;border-radius:50%;width:30px;height:30px;display:grid;place-items:center}}
.arrow{{font-size:18px;color:#ffcf4a;font-weight:900}} .act{{font-size:28px}}
.pair span{{font-size:28px;padding:2px 4px;border-radius:10px;opacity:.35}} .pair span.ans{{opacity:1;box-shadow:0 0 0 3px #ffcf4a}}
.need span{{display:inline-block;background:#0006;border-radius:8px;padding:3px 8px;margin:3px;font-size:13px}}
.demo{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 4px}}
</style></head><body><main>
<h1>基礎單字集（第三版）</h1>
<p class="muted">第一層是 NSM 的 65 個語意基元：幾乎所有語言都有對應字的核心意思，也是「我的理解」最基本的材料。第二層是從 CEFR-J A1 整理的日常概念。點任一格看說明。</p>
<h1 style="margin-top:18px">第一層：NSM 語意基元（{len(primes)}）</h1>
<p class="muted">英文為 NSM 標準說法；日文是依 NSM 文獻整理的草稿，需要母語者確認。點線框 = 圖示待設計。</p>
<div class="bar" id="pbar"></div><div class="grid" id="pgrid"></div>
<h1 style="margin-top:24px">第二層：日常概念（{len(rows)}）</h1>
<p class="muted">從 CEFR-J A1 的實詞整理出 {len(rows)} 個以圖像定義的概念。實線框 = 單看圖就明確（A），虛線框 = 慣用或組合圖示、需搭配例句（B）。點任一格看英文說明與 CEFR-J 原字。</p>
<p class="muted">組合圖示只用四種固定模板：</p>
<div class="demo" id="demo"></div>
<div class="bar" id="bar"></div><div class="bar" id="bar2"></div><div class="grid" id="grid"></div>
<h1 style="margin-top:24px">還需要另外找圖示（{len(need)}）</h1>
<p class="muted">日常、具體，但 emoji 和組合模板都表達不清楚的字。親屬稱謂建議之後用小型家族圖示處理。</p>
<div class="need">{''.join(f'<span>{html.escape(n)}</span>' for n in need)}</div>
<p class="muted" style="margin-top:24px">資料來源：The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.</p>
</main><script>
const rows={data};
const primes={pdata};
const TPL={json.dumps(TPL, ensure_ascii=False)};
function icon(r){{
  const s=r.icon;
  if(r.template==='place'||r.template==='role'){{const [a,b]=s.split('+');return `<span class="combo">${{a}}<small>${{b}}</small></span>`;}}
  if(r.template==='action'){{const [a,b]=s.split('>');return `<span class="act">${{a}}</span><span class="arrow">➜</span><span class="act">${{b}}</span>`;}}
  if(r.template==='contrast'){{return `<span class="pair">${{s.split('|').map(x=>`<span class="${{x.startsWith('*')?'ans':''}}">${{x.replace('*','')}}</span>`).join('')}}</span>`;}}
  return s;
}}
const card=r=>`<div class="c ${{r.clarity}}"><div class="ic">${{icon(r)}}</div><div class="w">${{r.id.replace(/_/g,' ')}}</div><div class="g">${{r.upos}}${{r.template!=='single'?' · '+TPL[r.template]:''}}</div></div>`;
document.getElementById('demo').innerHTML=['kitchen','driver','buy','big'].map(id=>card(rows.find(r=>r.id===id))).join('');
const cats=['全部',...new Set(rows.map(r=>r.category))];
const tpls=['全部模板',...Object.keys(TPL)];
let cur='全部',tpl='全部模板';
function render(){{
 const btns=(arr,val,key,lab)=>arr.map(c=>`<button class="${{c===val?'on':''}}" data-${{key}}="${{c}}">${{lab(c)}}</button>`).join('');
 document.getElementById('bar').innerHTML=btns(cats,cur,'c',c=>`${{c}} ${{c==='全部'?rows.length:rows.filter(r=>r.category===c).length}}`);
 document.getElementById('bar2').innerHTML=btns(tpls,tpl,'t',t=>`${{TPL[t]||t}} ${{t==='全部模板'?rows.length:rows.filter(r=>r.template===t).length}}`);
 document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{{cur=b.dataset.c;render();}});
 document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{{tpl=b.dataset.t;render();}});
 const list=rows.filter(r=>(cur==='全部'||r.category===cur)&&(tpl==='全部模板'||r.template===tpl));
 document.getElementById('grid').innerHTML=list.map(card).join('');
 document.querySelectorAll('#grid .c').forEach((el,i)=>el.onclick=()=>alert(list[i].gloss+'\\nCEFR-J: '+list[i].cefrj_headwords.replace(/;/g,', ')));
}}
render();
let pg='全部';
function renderPrimes(){{
 const groups=['全部',...new Set(primes.map(p=>p.group))];
 document.getElementById('pbar').innerHTML=groups.map(g=>`<button class="${{g===pg?'on':''}}" data-g="${{g}}">${{g}}</button>`).join('');
 document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{{pg=b.dataset.g;renderPrimes();}});
 const list=primes.filter(p=>pg==='全部'||p.group===pg);
 document.getElementById('pgrid').innerHTML=list.map(p=>`<div class="c ${{p.clarity}}"><div class="ic">${{p.template==='todo'?'<span class="todo">待設計</span>':icon(p)}}</div><div class="w">${{p.en}}</div><div class="ja">${{p.ja_draft}}</div></div>`).join('');
 document.querySelectorAll('#pgrid .c').forEach((el,i)=>el.onclick=()=>alert(list[i].id+'（'+list[i].group+'）\nEN: '+list[i].en+'\nJA（草稿）: '+list[i].ja_draft+(list[i].merges?'\n併入的第二層概念: '+list[i].merges:'')));
}}
renderPrimes();
</script></body></html>'''
open('../../site/concepts.html', 'w', encoding='utf-8').write(page)
print('ok', len(rows))
