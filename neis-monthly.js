/*
 * neis-monthly.js
 * PAIR IEP Builder — 학기 계획의 월별 전개 및 나이스(NEIS) 자동입력용 JSON 내보내기
 *
 * 전제: app.js 안에서 window.PAIR = { state, showToast, escapeHtml } 를 노출해야 합니다.
 * 로드 순서: curriculum-data.js → app.js → neis-monthly.js
 */
(() => {
  'use strict';

  const PAIR = window.PAIR;
  if (!PAIR) {
    console.warn('[NEIS] PAIR 브리지를 찾지 못했습니다. app.js 패치를 확인하세요.');
    return;
  }

  const { state, showToast } = PAIR;
  const esc = PAIR.escapeHtml || ((v = '') => String(v));
  const $ = (s) => document.querySelector(s);

  const SEMESTER_MONTHS = {
    '1학기': ['3', '4', '5', '6', '7', '8'],
    '2학기': ['9', '10', '11', '12', '1', '2']
  };

  const monthly = { plan: [], evals: [], groupSize: 1, tab: 'plan', ready: false };
  state.monthly = monthly;

  /* ---------------------------------------------------------------- 유틸 */

  function currentMonths() {
    const semester = state.inputSnapshot?.semester || $('#semesterSelect')?.value || '1학기';
    return SEMESTER_MONTHS[semester] || SEMESTER_MONTHS['1학기'];
  }

  function seedIfEmpty() {
    const months = currentMonths();
    if (!monthly.plan.length) {
      monthly.plan = months.map((month) => ({ month, goal: '', content: '', method: '', evaluation: '' }));
    }
    if (!monthly.evals.length) {
      monthly.evals = months.map((month) => ({ month, observation: '', eval_text: '' }));
    }
  }

  function semesterSourceText() {
    const r = state.result;
    if (!r) return '';
    const goal = r.semesterGoal || {};
    const evalPlan = r.evaluationPlan || {};
    const lines = [];

    lines.push('[학기 목표]');
    lines.push(goal.statement || '');
    if (goal.reflectionOfNeeds) lines.push(`요구 반영: ${goal.reflectionOfNeeds}`);
    if (Array.isArray(goal.phasedObjectives) && goal.phasedObjectives.length) {
      lines.push('단계 목표:');
      goal.phasedObjectives.forEach((item, i) => lines.push(`  ${i + 1}) ${item}`));
    }

    lines.push('', '[교육내용]');
    (r.educationContent || []).forEach((item) => {
      lines.push(`- ${item.sequence || ''} / ${item.focus || ''}`);
      (item.activities || []).forEach((a) => lines.push(`    · ${a}`));
      if (item.curriculumConnection) lines.push(`    연계: ${item.curriculumConnection}`);
    });

    lines.push('', '[교육방법]');
    (r.educationMethods || []).forEach((item) => {
      lines.push(`- ${item.strategy || ''}: ${item.application || ''}`);
      if (item.supports) lines.push(`    지원: ${item.supports}`);
      if (item.caution) lines.push(`    유의: ${item.caution}`);
    });

    lines.push('', '[평가계획]');
    (evalPlan.focuses || []).forEach((f) => lines.push(`- 초점: ${f}`));
    (evalPlan.indicators || []).forEach((i) => {
      lines.push(`- 지표: ${i.behavior || ''} / 조건 ${i.condition || ''} / 기준 ${i.criterion || ''} / 방법 ${i.method || ''} / 시기 ${i.timing || ''}`);
    });
    if ((evalPlan.recordingTools || []).length) lines.push(`- 기록 도구: ${evalPlan.recordingTools.join(', ')}`);
    if (evalPlan.generalizationPlan) lines.push(`- 유지·일반화: ${evalPlan.generalizationPlan}`);

    const meta = state.inputSnapshot || {};
    lines.unshift(`[기본 설정] ${meta.schoolLevelLabel || ''} ${meta.grade || ''} ${meta.semester || ''} ${meta.planTypeLabel || ''} ${meta.selectionName || ''}`, '');
    return lines.join('\n').trim();
  }

  function buildPlanPrompt() {
    const months = currentMonths();
    return `당신은 나이스(NEIS) 개별화교육계획 「월별계획」 변환기입니다.
아래 학기 단위 개별화교육계획을 ${months[0]}월부터 ${months[months.length - 1]}월까지 ${months.length}개월분 월별계획으로 전개하세요.

[출력 규칙]
1. 최상위 JSON 배열만 출력. [ 로 시작하고 ] 로 끝날 것.
2. 설명, 마크다운, 코드블록 표시 없이 순수 JSON만 출력.
3. items, schemaVersion 등 봉투 객체 금지.

[각 항목 필드 — NEIS 4칸과 1:1]
- month: 문자열. 순서는 ${months.join(' → ')}
- goal: 교육목표
- content: 교육내용
- method: 교육방법
- evaluation: 평가계획

[전개 원칙]
- 학기 목표를 진도로 쪼개지 말 것. 같은 목표를 향한 촉진 수준의 단계적 감소와 수행 장면의 확대로 전개할 것.
- 초기 월은 적응과 기초 형성, 중간 월은 반복과 정확도, 말기 월은 자발성·일반화·유지에 무게를 둘 것.
- evaluation은 실제 수업 중 실행 가능한 확인 방법으로 쓸 것. 지필 형식의 총괄 평가로 쓰지 말 것.
- 각 칸은 2문장 이내로 간결하게 쓸 것.
- 학생 이름, 학번, 학교명 등 식별정보는 넣지 말 것.

[학기 개별화교육계획]
${semesterSourceText()}`;
  }

  function buildEvalPrompt() {
    const rows = monthly.evals
      .filter((e) => e.observation.trim())
      .map((e) => `${e.month}월 관찰 기록: ${e.observation.trim()}`);
    return `당신은 나이스(NEIS) 개별화교육계획 「월별평가」 문장 작성 도우미입니다.
아래 교사의 월별 관찰 기록을 나이스 월별평가 본문 문장으로 다듬으세요.

[출력 규칙]
1. 최상위 JSON 배열만 출력. [ 로 시작하고 ] 로 끝날 것.
2. 설명, 마크다운, 코드블록 표시 없이 순수 JSON만 출력.
3. 각 항목 필드는 month(문자열)와 eval_text 두 개만 사용. evaluation 키 금지.

[작성 원칙]
- 관찰 기록에 없는 수행이나 변화를 새로 만들어 내지 말 것.
- 학생이 실제로 한 행동과 도움 수준을 중심으로 서술할 것.
- 단정적 진단 표현을 피하고 관찰된 사실로 기술할 것.
- 한 달당 2문장에서 3문장, 종결은 '~함', '~을 보임' 형태로 통일할 것.
- 학생 이름, 학번, 학교명 등 식별정보는 넣지 말 것.

[학기 목표 참고]
${state.result?.semesterGoal?.statement || ''}

[교사 관찰 기록]
${rows.join('\n') || '(관찰 기록이 비어 있습니다. 각 월 관찰 기록을 먼저 입력하세요.)'}`;
  }

  /* -------------------------------------------------------------- 파싱 */

  function parseArray(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('JSON 배열을 찾지 못했습니다. 최상위 배열 형태인지 확인하세요.');
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error('최상위가 배열이 아닙니다.');
    return parsed;
  }

  function applyPlanArray(items) {
    seedIfEmpty();
    let applied = 0;
    items.forEach((item) => {
      const months = Array.isArray(item.months) ? item.months.map(String) : [String(item.month ?? '')];
      months.forEach((m) => {
        const row = monthly.plan.find((p) => p.month === m);
        if (!row) return;
        row.goal = item.goal || '';
        row.content = item.content || '';
        row.method = item.method || '';
        row.evaluation = item.evaluation || '';
        applied += 1;
      });
    });
    if (!applied) throw new Error('이 학기의 월과 일치하는 항목이 없습니다. 학기 설정을 확인하세요.');
    return applied;
  }

  function applyEvalArray(items) {
    seedIfEmpty();
    let applied = 0;
    items.forEach((item) => {
      const row = monthly.evals.find((e) => e.month === String(item.month ?? ''));
      if (!row) return;
      row.eval_text = item.eval_text || item.evalText || '';
      applied += 1;
    });
    if (!applied) throw new Error('이 학기의 월과 일치하는 항목이 없습니다.');
    return applied;
  }

  /* ------------------------------------------------------------ 내보내기 */

  const SENSITIVE = [
    { label: '주민등록번호', regex: /\b\d{6}\s*-?\s*[1-4]\d{6}\b/ },
    { label: '전화번호', regex: /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/ },
    { label: '이메일 주소', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i }
  ];

  function auditText(text) {
    const found = SENSITIVE.filter((rule) => rule.regex.test(text)).map((rule) => rule.label);
    const alias = (state.inputSnapshot?.studentAlias || '').trim();
    if (alias && alias.length > 1 && text.includes(alias)) found.push('학생 구분명');
    return found;
  }

  function groupPlan(size) {
    const rows = monthly.plan.filter((p) => p.goal || p.content || p.method || p.evaluation);
    if (size <= 1) {
      return rows.map(({ month, goal, content, method, evaluation }) => ({ month, goal, content, method, evaluation }));
    }
    const out = [];
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size);
      const merge = (key) => [...new Set(chunk.map((c) => c[key]).filter(Boolean))].join('\n');
      out.push({
        months: chunk.map((c) => c.month),
        goal: merge('goal'),
        content: merge('content'),
        method: merge('method'),
        evaluation: merge('evaluation')
      });
    }
    return out;
  }

  function buildExport(kind) {
    const items = kind === 'plan'
      ? groupPlan(monthly.groupSize)
      : monthly.evals.filter((e) => e.eval_text.trim()).map(({ month, eval_text }) => ({ month, eval_text }));

    if (!items.length) throw new Error(kind === 'plan' ? '내보낼 월별계획이 없습니다.' : '내보낼 월별평가 문장이 없습니다.');

    if (kind === 'plan') {
      const missing = items.filter((i) => !i.goal || !i.content || !i.method || !i.evaluation);
      if (missing.length) throw new Error('네 칸이 모두 채워지지 않은 월이 있습니다. 빈 칸을 확인하세요.');
    }

    const json = JSON.stringify(items, null, 2);
    const flagged = auditText(json);
    if (flagged.length) throw new Error(`${flagged.join(', ')}(으)로 보이는 정보가 있습니다. 지운 뒤 다시 시도하세요.`);
    return json;
  }

  async function copyText(text, doneMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(doneMessage);
    } catch (_) {
      showToast('복사하지 못했습니다. 브라우저 권한을 확인하세요.');
    }
  }

  function downloadJson(json, name) {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* -------------------------------------------------------------- 렌더 */

  function planCards() {
    return monthly.plan.map((row, i) => `
      <article class="month-card">
        <header><b>${esc(row.month)}월</b></header>
        <label>교육목표<textarea data-kind="plan" data-index="${i}" data-field="goal" rows="2">${esc(row.goal)}</textarea></label>
        <label>교육내용<textarea data-kind="plan" data-index="${i}" data-field="content" rows="2">${esc(row.content)}</textarea></label>
        <label>교육방법<textarea data-kind="plan" data-index="${i}" data-field="method" rows="2">${esc(row.method)}</textarea></label>
        <label>평가계획<textarea data-kind="plan" data-index="${i}" data-field="evaluation" rows="2">${esc(row.evaluation)}</textarea></label>
      </article>`).join('');
  }

  function evalCards() {
    return monthly.evals.map((row, i) => `
      <article class="month-card">
        <header><b>${esc(row.month)}월</b></header>
        <label>관찰 기록<textarea data-kind="eval" data-index="${i}" data-field="observation" rows="3" placeholder="이 달에 실제로 관찰한 수행, 도움 수준, 변화를 입력하세요."></textarea></label>
        <label>월별평가 본문<textarea data-kind="eval" data-index="${i}" data-field="eval_text" rows="3" placeholder="관찰 기록을 입력한 뒤 문장으로 다듬거나 직접 작성하세요."></textarea></label>
      </article>`).join('');
  }

  function render() {
    const isPlan = monthly.tab === 'plan';
    $('#neisTabPlan').classList.toggle('active', isPlan);
    $('#neisTabEval').classList.toggle('active', !isPlan);
    $('#neisGroupWrap').classList.toggle('hidden', !isPlan);
    $('#neisGenerateBtn').textContent = isPlan ? 'AI로 월별 전개' : '관찰 기록을 문장으로 다듬기';
    $('#neisCards').innerHTML = isPlan ? planCards() : evalCards();

    if (!isPlan) {
      monthly.evals.forEach((row, i) => {
        $(`textarea[data-kind="eval"][data-index="${i}"][data-field="observation"]`).value = row.observation;
        $(`textarea[data-kind="eval"][data-index="${i}"][data-field="eval_text"]`).value = row.eval_text;
      });
    }
  }

  function message(text, tone = 'info') {
    const box = $('#neisMessage');
    box.textContent = text;
    box.dataset.tone = tone;
    box.classList.toggle('hidden', !text);
  }

  /* ------------------------------------------------------------ UI 구성 */

  function mount() {
    const toolbar = document.querySelector('#resultSection .toolbar-actions');
    if (toolbar && !$('#monthlyBtn')) {
      const button = document.createElement('button');
      button.id = 'monthlyBtn';
      button.type = 'button';
      button.className = 'btn small ghost';
      button.textContent = '월별 전개';
      toolbar.insertBefore(button, toolbar.firstChild);
      button.addEventListener('click', openPanel);
    }

    if ($('#neisPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'neisPanel';
    panel.className = 'neis-panel hidden';
    panel.innerHTML = `
      <div class="neis-head">
        <div>
          <h3>월별 전개와 나이스 입력</h3>
          <p>학기 계획을 월별로 전개한 뒤, 나이스 월별계획·월별평가 입력용 JSON으로 내보냅니다.</p>
        </div>
        <div class="neis-tabs" role="tablist">
          <button id="neisTabPlan" class="neis-tab active" type="button" role="tab">월별계획</button>
          <button id="neisTabEval" class="neis-tab" type="button" role="tab">월별평가</button>
        </div>
      </div>

      <div class="neis-actions">
        <button id="neisGenerateBtn" class="btn primary small" type="button">AI로 월별 전개</button>
        <button id="neisPromptBtn" class="btn ghost small" type="button">프롬프트 복사</button>
        <button id="neisPasteToggle" class="btn ghost small" type="button">AI 응답 붙여넣기</button>
      </div>

      <div id="neisPasteWrap" class="neis-paste hidden">
        <textarea id="neisPasteArea" rows="5" placeholder="AI가 준 JSON 배열을 그대로 붙여넣으세요."></textarea>
        <button id="neisPasteApply" class="btn small dark" type="button">붙여넣은 내용 적용</button>
      </div>

      <div id="neisMessage" class="neis-message hidden" role="status"></div>

      <div id="neisCards" class="month-cards"></div>

      <div class="neis-export">
        <div id="neisGroupWrap" class="neis-group">
          <label for="neisGroupSize">나이스 한 행에 넣을 개월 수</label>
          <select id="neisGroupSize">
            <option value="1">1개월씩</option>
            <option value="2">2개월 묶기</option>
            <option value="3">3개월 묶기</option>
          </select>
        </div>
        <div class="neis-export-actions">
          <button id="neisCopyJson" class="btn accent small" type="button">나이스용 JSON 복사</button>
          <button id="neisSaveJson" class="btn ghost small" type="button">JSON 파일 저장</button>
        </div>
      </div>

      <p class="neis-note">월별평가는 실제 관찰 기록을 입력한 뒤 작성하세요. 수행이 일어나기 전에 평가 문장을 미리 만들어 두지 않습니다.</p>`;

    $('#resultContent').insertAdjacentElement('afterend', panel);
    bind();
  }

  function openPanel() {
    if (!state.result) return showToast('먼저 개별화교육계획을 생성하세요.');
    seedIfEmpty();
    monthly.ready = true;
    $('#neisPanel').classList.remove('hidden');
    render();
    $('#neisPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bind() {
    $('#neisTabPlan').addEventListener('click', () => { monthly.tab = 'plan'; message(''); render(); });
    $('#neisTabEval').addEventListener('click', () => { monthly.tab = 'eval'; message(''); render(); });

    $('#neisCards').addEventListener('input', (event) => {
      const node = event.target;
      if (node.tagName !== 'TEXTAREA') return;
      const bucket = node.dataset.kind === 'plan' ? monthly.plan : monthly.evals;
      bucket[Number(node.dataset.index)][node.dataset.field] = node.value;
    });

    $('#neisGroupSize').addEventListener('change', (event) => { monthly.groupSize = Number(event.target.value); });

    $('#neisPromptBtn').addEventListener('click', () => {
      const prompt = monthly.tab === 'plan' ? buildPlanPrompt() : buildEvalPrompt();
      copyText(prompt, '프롬프트를 복사했습니다. 쓰시는 AI에 붙여넣으세요.');
    });

    $('#neisPasteToggle').addEventListener('click', () => $('#neisPasteWrap').classList.toggle('hidden'));

    $('#neisPasteApply').addEventListener('click', () => {
      try {
        const items = parseArray($('#neisPasteArea').value);
        const applied = monthly.tab === 'plan' ? applyPlanArray(items) : applyEvalArray(items);
        render();
        message(`${applied}개월분을 적용했습니다. 내용을 확인한 뒤 내보내세요.`, 'ok');
        $('#neisPasteArea').value = '';
        $('#neisPasteWrap').classList.add('hidden');
      } catch (error) {
        message(error.message, 'error');
      }
    });

    $('#neisGenerateBtn').addEventListener('click', generate);

    $('#neisCopyJson').addEventListener('click', () => {
      try {
        copyText(buildExport(monthly.tab), '나이스용 JSON을 복사했습니다. 확장 프로그램에 붙여넣으세요.');
        message('', 'info');
      } catch (error) {
        message(error.message, 'error');
      }
    });

    $('#neisSaveJson').addEventListener('click', () => {
      try {
        const json = buildExport(monthly.tab);
        downloadJson(json, monthly.tab === 'plan' ? 'NEIS_월별계획' : 'NEIS_월별평가');
        message('', 'info');
      } catch (error) {
        message(error.message, 'error');
      }
    });
  }

  async function generate() {
    const button = $('#neisGenerateBtn');
    const kind = monthly.tab;
    if (kind === 'eval' && !monthly.evals.some((e) => e.observation.trim())) {
      return message('각 월의 관찰 기록을 먼저 입력하세요. 관찰 없이 평가 문장을 만들지 않습니다.', 'error');
    }

    button.disabled = true;
    button.textContent = '생성하는 중';
    message('');

    try {
      const response = await fetch('/api/expand-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          months: currentMonths(),
          prompt: kind === 'plan' ? buildPlanPrompt() : buildEvalPrompt(),
          semesterResult: state.result,
          inputSummary: state.inputSnapshot
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '생성에 실패했습니다.');

      const items = Array.isArray(body.result) ? body.result : parseArray(body.text || '');
      const applied = kind === 'plan' ? applyPlanArray(items) : applyEvalArray(items);
      render();
      message(`${applied}개월분을 생성했습니다. 교사 검토 뒤 내보내세요.`, 'ok');
    } catch (error) {
      $('#neisPasteWrap').classList.remove('hidden');
      message(`자동 생성을 쓸 수 없습니다(${error.message}). 「프롬프트 복사」로 쓰시는 AI에 붙여넣고, 받은 JSON을 아래에 붙여넣으세요.`, 'error');
    } finally {
      button.disabled = false;
      render();
    }
  }

  mount();
})();
