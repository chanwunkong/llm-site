// 技能（文法）頁：依 CEFR 階段呈現 WALS 文法規則，並和「我會的語言」比較
// 第一層：目前階段可計分的技能（可解鎖）；第二層：文法對照（參考，不計分）
import { L, save, RULES, known, currentStage, stageReached, STAGE_ORDER } from '../engine/store.js';
import { WALS, profileOf } from '../engine/run.js';
import { STAGES, FEATURES, LANGS, VALUES } from '../data/wals.js';
import { joinTokens } from '../engine/content.js';
import { sfx, speak } from '../audio.js';
import { esc, toast, openSheet } from './sheet.js';
import { editKnown, knownRow, langName } from './known.js';
import { G } from './glyph.js';

const label = (fid, num) => (num ? FEATURES[fid].values[num] || num : '沒有資料');
const DOMAINS = ['詞序', '形態', '名詞與動詞範疇', '子句構造'];

export function createSkills(root, { getLang, onChange }) {
  let onlyDiff = true;

  const target = () => getLang().wals;
  const knownIds = () => known().filter(id => id !== target());

  // 比較：目標語言的值是否出現在任何一種「我會的語言」裡
  function verdict(fid) {
    const vt = VALUES[target()]?.[fid];
    if (!vt) return 'nodata';
    const ks = knownIds().map(id => VALUES[id]?.[fid]).filter(Boolean);
    if (!ks.length) return 'nodata';
    return ks.includes(vt) ? 'known' : 'hard';
  }
  const TAG = { hard: '<span class="tag hard">難規則</span>', known: '<span class="tag ok">已經會</span>', nodata: '<span class="tag">沒有資料</span>' };

  function compareLine(fid) {
    const t = target();
    const parts = [`<span class="tgt">${esc(langName(t))}：${esc(label(fid, VALUES[t]?.[fid]))}</span>`];
    for (const id of knownIds()) parts.push(`${esc(langName(id))}：${esc(label(fid, VALUES[id]?.[fid]))}`);
    return parts.join('<br>');
  }

  // 從學習者的來源句子找出用到這條規則的例子
  function examples(rule, n) {
    const lang = getLang(), out = [];
    for (const s of lang.sentences) {
      const sp = rule.spans(s.tokens, profileOf(lang))[0];
      if (!sp) continue;
      const tk = s.tokens;
      const html = esc(joinTokens(tk.slice(0, sp[0]), lang.joiner) + (sp[0] ? lang.joiner : '')) +
        `<mark>${esc(joinTokens(tk.slice(sp[0], sp[1] + 1), lang.joiner))}</mark>` +
        esc((sp[1] + 1 < tk.length && tk[sp[1] + 1].upos !== 'PUNCT' ? lang.joiner : '') + joinTokens(tk.slice(sp[1] + 1), lang.joiner));
      out.push({ html, text: joinTokens(tk, lang.joiner), span: joinTokens(tk.slice(sp[0], sp[1] + 1), lang.joiner) });
      if (out.length >= n) break;
    }
    return out;
  }

  function render() {
    const lg = L(), st = currentStage();
    const stageChapters = STAGES[st.stage].domains;
    const stageFids = Object.values(stageChapters).flat().map(ch => Object.keys(FEATURES).find(f => FEATURES[f].ch === ch));
    const counts = { hard: 0, known: 0 };
    stageFids.forEach(f => { const v = verdict(f); if (counts[v] !== undefined) counts[v]++; });
    const rules = WALS.filter(r => stageReached(r.stage))
      .sort((a, b) => (verdict(a.id) === 'hard' ? 0 : 1) - (verdict(b.id) === 'hard' ? 0 : 1));
    const next = STAGE_ORDER[st.index + 1];
    const nextNames = next ? Object.values(STAGES[next].domains).flat().slice(0, 6).map(ch => FEATURES[Object.keys(FEATURES).find(f => FEATURES[f].ch === ch)].zh) : [];

    root.innerHTML = `<div class="skills-page">
      <h2>文法</h2>
      ${knownRow(target())}

      <div class="panel stage-card">
        <div class="stage-head"><b>目前階段 ${st.stage}</b><span class="muted">詞彙 ${st.vocab}${st.next ? ` / ${st.next.toLocaleString()} → ${next}` : ''}</span></div>
        ${st.next ? `<div class="bar"><i style="width:${Math.min(100, (st.vocab / st.next) * 100)}%"></i></div>` : ''}
        <div class="stage-sum"><span><b class="hardc">${counts.hard}</b> 難規則</span><span><b>${counts.known}</b> 已經會</span><span><b>${rules.filter(r => lg.unlocked.includes(r.id)).length}</b> 已解鎖</span></div>
      </div>

      <h3>可計分的技能</h3>
      <p class="muted">解鎖後，冒險中升級時才有機會選到；空格用到這條規則、而且答對時，分數 +50%。和你會的語言不同的「難規則」排在前面。</p>
      ${rules.map(r => {
        const on = lg.unlocked.includes(r.id), v = verdict(r.id), ex = examples(r, 1)[0];
        return `<div class="rule${on ? ' on' : ''}${v === 'hard' ? ' hard' : ''}" data-f="${r.id}">
          <div class="ic">${r.id}</div>
          <div><b>${esc(r.name)}</b> ${TAG[v]}${r.approx ? ' <span class="tag">近似判斷</span>' : ''}
            <small>${compareLine(r.id)}</small>
            ${ex ? `<small class="ex">例：${esc(ex.span)}</small>` : '<small class="muted">你目前的來源裡還沒有例子</small>'}</div>
          ${on ? '<span class="own">已解鎖</span>' : `<button class="btn gold sm" data-unlock="${r.id}" ${lg.gold < RULES.walsCost ? 'disabled' : ''}>${RULES.walsCost} 金幣</button>`}
        </div>`;
      }).join('')}
      ${next ? `<p class="muted">下一階段 ${next} 會出現：${nextNames.map(esc).join('、')}…（詞彙達到 ${st.next.toLocaleString()} 字）</p>` : ''}

      <h3>文法對照（參考，不計分）</h3>
      <div class="row-between"><span class="muted">${esc(langName(target()))}和你會的語言，在各個文法特徵上的比較</span>
        <button class="btn ghost sm" id="diffBtn">${onlyDiff ? '只看差異 ●' : '顯示全部 ○'}</button></div>
      ${DOMAINS.map(dom => {
        const items = STAGE_ORDER.flatMap(s => (STAGES[s].domains[dom] || []).map(ch => ({ s, fid: Object.keys(FEATURES).find(f => FEATURES[f].ch === ch) })))
          .filter(x => !onlyDiff || verdict(x.fid) === 'hard');
        return `<details class="cmp"${dom === '詞序' ? ' open' : ''}><summary>${dom}（${items.length}）</summary>
          ${items.map(x => `<button class="cmp-row" data-f="${x.fid}"><span class="tag">${x.s}</span><b>${esc(FEATURES[x.fid].zh)}</b> ${TAG[verdict(x.fid)]}</button>`).join('') || '<p class="muted">沒有差異</p>'}
        </details>`;
      }).join('')}
      <p class="muted">資料來源：Dryer & Haspelmath (eds.) 2013, <i>The World Atlas of Language Structures Online</i>（CC BY 4.0）。課綱分級見 docs/curriculum.md。</p>
    </div>`;

    root.querySelectorAll('[data-unlock]').forEach(b => (b.onclick = e => {
      e.stopPropagation();
      if (lg.gold < RULES.walsCost) return toast('金幣不足');
      lg.gold -= RULES.walsCost;
      lg.unlocked.push(b.dataset.unlock);
      save();
      sfx('level');
      toast(`解鎖：${WALS.find(r => r.id === b.dataset.unlock).name}`);
      render();
      onChange?.();
    }));
    root.querySelectorAll('[data-f]').forEach(el => (el.onclick = () => detail(el.dataset.f)));
    root.querySelector('#diffBtn').onclick = () => { onlyDiff = !onlyDiff; render(); };
    root.querySelector('[data-edit-known]').onclick = () => editKnown(target(), render);
  }

  function detail(fid) {
    const f = FEATURES[fid], rule = WALS.find(r => r.id === fid), v = verdict(fid);
    const exs = rule ? examples(rule, 5) : [];
    const ids = [target(), ...knownIds()];
    openSheet(`
      <h2>${esc(f.zh)} ${TAG[v]}</h2>
      <p class="muted">WALS ${fid}・${esc(f.en)}${rule ? '' : '<br>這項屬於整個語言的特性，只做比較，不計分。'}</p>
      <div class="stack">${ids.map((id, i) => `<div class="cmp-val"><span>${esc(langName(id))}${i === 0 ? '（目標）' : ''}</span><b>${esc(label(fid, VALUES[id]?.[fid]))}</b></div>`).join('')}</div>
      ${v === 'hard' ? '<p class="muted">你會的語言都不是這樣，學的時候要特別留意。</p>' : ''}
      ${rule ? `<h3>你的來源裡的例子</h3>${exs.length ? `<div class="stack">${exs.map((x, i) => `<button class="ex-row" data-i="${i}">${x.html} ${G.speaker(14)}</button>`).join('')}</div>` : '<p class="muted">目前的來源裡還沒有例子。</p>'}` : ''}
    `, {}, body => body.querySelectorAll('[data-i]').forEach(b => (b.onclick = () => speak(exs[+b.dataset.i].text, { rate: 0.85 }))));
  }

  return { show: render, hide() {}, render };
}
