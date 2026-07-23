(() => {
  'use strict';

  const data = window.CURRICULUM_DATA;
  if (!data) throw new Error('교육과정 데이터가 로드되지 않았습니다.');

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const state = {
    step: 1,
    schoolLevel: '',
    planType: '',
    selectionName: '',
    lifeAdaptationDetail: '',
    result: null,
    resultMeta: null,
    inputSnapshot: null
  };

  const schoolLabels = { elementary: '초등학교', middle: '중학교', high: '고등학교' };
  const planTypeLabels = { subject: '교과형', life: '생활기능 중심' };
  const gradeOptions = {
    elementary: ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'],
    middle: ['1학년', '2학년', '3학년'],
    high: ['1학년', '2학년', '3학년']
  };

  const els = {
    schoolLevel: $('#schoolLevel'),
    planTypes: $$('input[name="planType"]'),
    typeCards: $$('.type-card'),
    selectionArea: $('#selectionArea'),
    subjectSelection: $('#subjectSelection'),
    lifeSelection: $('#lifeSelection'),
    subjectSelect: $('#subjectSelect'),
    lifeAreaList: $('#lifeAreaList'),
    lifeAreaInfo: $('#lifeAreaInfo'),
    adaptationDetailWrap: $('#adaptationDetailWrap'),
    adaptationDetail: $('#adaptationDetail'),
    gradeSelect: $('#gradeSelect'),
    semesterSelect: $('#semesterSelect'),
    studentAlias: $('#studentAlias'),
    standardsList: $('#standardsList'),
    standardCountBadge: $('#standardCountBadge'),
    subjectStandardSection: $('#subjectStandardSection'),
    lifeSceneSection: $('#lifeSceneSection'),
    contextSummary: $('#contextSummary'),
    formMessage: $('#formMessage'),
    reviewSummary: $('#reviewSummary'),
    generateBtn: $('#generateBtn'),
    generateBox: $('#generateBox'),
    loadingState: $('#loadingState'),
    loadingTitle: $('#loadingTitle'),
    loadingMessage: $('#loadingMessage'),
    apiMessage: $('#apiMessage'),
    resultSection: $('#resultSection'),
    resultContent: $('#resultContent'),
    modeBadge: $('#modeBadge'),
    regenerateBtn: $('#regenerateBtn'),
    toast: $('#toast')
  };

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function setStep(step) {
    state.step = step;
    $$('.step-panel').forEach((panel, index) => panel.classList.toggle('active', index + 1 === step));
    $$('.step').forEach((button, index) => {
      const current = index + 1;
      button.classList.toggle('active', current === step);
      button.classList.toggle('complete', current < step);
      button.disabled = current > step;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateTypeCards() {
    els.typeCards.forEach((card) => {
      const input = card.querySelector('input');
      card.classList.toggle('selected', input.checked);
    });
  }

  function updateSelectionControls() {
    state.schoolLevel = els.schoolLevel.value;
    state.planType = els.planTypes.find((input) => input.checked)?.value || '';
    updateTypeCards();

    const ready = state.schoolLevel && state.planType;
    els.selectionArea.classList.toggle('hidden', !ready);
    els.subjectSelection.classList.toggle('hidden', state.planType !== 'subject');
    els.lifeSelection.classList.toggle('hidden', state.planType !== 'life');

    if (!ready) return;
    if (state.planType === 'subject') populateSubjects();
    if (state.planType === 'life') populateLifeAreas();
  }

  function subjectsForCurrentBand() {
    const band = selectedSchoolBand();
    return (data.subjectsByLevel[state.schoolLevel] || [])
      .filter((subject) => (data.standardsBySubject[subject] || []).some((item) => item.gradeBand === band));
  }

  function populateSubjects() {
    const previous = els.subjectSelect.value;
    const subjects = subjectsForCurrentBand();
    els.subjectSelect.innerHTML = '<option value="">교과를 선택하세요</option>' + subjects
      .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('');
    els.subjectSelect.value = subjects.includes(previous) ? previous : '';
    state.selectionName = state.planType === 'subject' ? els.subjectSelect.value : state.selectionName;
  }

  function populateLifeAreas() {
    if (els.lifeAreaList.childElementCount) return;
    els.lifeAreaList.innerHTML = data.lifeAreas
      .map((area) => `<label class="area-item"><input type="checkbox" name="lifeArea" value="${escapeHtml(area.id)}" /><span>${escapeHtml(area.name)}</span></label>`).join('');
  }

  function selectedLifeAreas() {
    const checkedIds = collectChecked('lifeArea');
    return data.lifeAreas.filter((area) => checkedIds.includes(area.id));
  }

  function lifeSelectionName() {
    return selectedLifeAreas().map((area) => area.name).join(' · ');
  }

  function updateLifeAreaInfo() {
    const areas = selectedLifeAreas();
    els.lifeAreaInfo.classList.toggle('hidden', !areas.length);
    els.adaptationDetailWrap.classList.toggle('hidden', !areas.some((area) => area.id === 'life_adaptation'));
    els.lifeAreaInfo.innerHTML = areas
      .map((area) => `<div class="area-info"><b>${escapeHtml(area.name)}</b><p>${escapeHtml(area.description)}</p><div class="tag-row">${area.contentElements.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div></div>`).join('');
  }

  function selectedSchoolBand() {
    if (state.schoolLevel === 'middle') return '9';
    if (state.schoolLevel === 'high') return '12';
    const grade = Number(els.gradeSelect.value.replace(/\D/g, ''));
    if (grade <= 2) return '2';
    if (grade <= 4) return '4';
    return '6';
  }

  function populateGrades() {
    const previous = els.gradeSelect.value;
    const options = gradeOptions[state.schoolLevel] || [];
    els.gradeSelect.innerHTML = options.length
      ? options.map((grade) => `<option value="${grade}">${grade}</option>`).join('')
      : '<option value="">학교급을 먼저 선택하세요</option>';
    if (options.includes(previous)) els.gradeSelect.value = previous;
  }

  function populateStandards() {
    if (state.planType !== 'subject' || !state.selectionName) return;
    const band = selectedSchoolBand();
    const standards = (data.standardsBySubject[state.selectionName] || []).filter((item) => item.gradeBand === band);
    els.standardsList.innerHTML = standards.length
      ? `<p class="band-label">${escapeHtml(data.gradeLabels[band])} · ${escapeHtml(state.selectionName)}</p>` + standards
        .map((item) => `<label class="standard-item"><input type="checkbox" name="standardCheck" value="${escapeHtml(item.code)}" data-description="${escapeHtml(item.description)}" /><span><b>[${escapeHtml(item.code)}]</b> ${escapeHtml(item.description)}</span></label>`).join('')
      : '<p class="empty-note">해당 학년군의 성취기준이 없습니다. 1단계에서 학년과 교과를 다시 확인해 주세요.</p>';
    updateStandardCount();
  }

  function updateStandardCount() {
    const count = $$('input[name="standardCheck"]:checked').length;
    els.standardCountBadge.textContent = `${count}개 선택`;
  }

  function buildContextSummary() {
    const chips = [`${schoolLabels[state.schoolLevel]} ${els.gradeSelect.value}`, planTypeLabels[state.planType], state.selectionName];
    if (state.lifeAdaptationDetail) chips.push(state.lifeAdaptationDetail);
    els.contextSummary.innerHTML = chips.filter(Boolean).map((item) => `<span class="summary-chip">${escapeHtml(item)}</span>`).join('');
  }

  function collectChecked(name) {
    return $$(`input[name="${name}"]:checked`).map((input) => input.value);
  }

  function selectedStandards() {
    return $$('input[name="standardCheck"]:checked').map((input) => ({
      code: input.value,
      description: input.dataset.description || ''
    }));
  }

  function scanSensitiveData(text) {
    const rules = [
      { label: '주민등록번호', regex: /\b\d{6}\s*-?\s*[1-4]\d{6}\b/ },
      { label: '전화번호', regex: /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/ },
      { label: '이메일 주소', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i }
    ];
    return rules.filter((rule) => rule.regex.test(text)).map((rule) => rule.label);
  }

  function collectPayload() {
    const areas = state.planType === 'life' ? selectedLifeAreas() : [];
    const sessionId = localStorage.getItem('iep-session-id') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    localStorage.setItem('iep-session-id', sessionId);

    return {
      sessionId,
      schoolLevel: state.schoolLevel,
      schoolLevelLabel: schoolLabels[state.schoolLevel],
      planType: state.planType,
      planTypeLabel: planTypeLabels[state.planType],
      selectionName: state.planType === 'subject' ? els.subjectSelect.value : areas.map((area) => area.name).join(' · '),
      selectedLifeAreas: areas.map((area) => ({ name: area.name, description: area.description })),
      lifeAdaptationDetail: state.planType === 'life' && areas.some((area) => area.id === 'life_adaptation') ? els.adaptationDetail.value : '',
      grade: els.gradeSelect.value,
      semester: els.semesterSelect.value,
      studentAlias: els.studentAlias.value.trim(),
      selectedStandards: state.planType === 'subject' ? selectedStandards() : [],
      subjectSkillDirections: state.planType === 'subject' ? collectChecked('skillDirection') : [],
      lifeScenes: state.planType === 'life' ? collectChecked('lifeScene') : [],
      currentLevel: $('#currentLevel').value.trim(),
      semesterGoalDraft: $('#semesterGoalDraft').value.trim(),
      studentParentNeeds: $('#studentParentNeeds').value.trim(),
      strengthsInterests: $('#strengthsInterests').value.trim(),
      supportNeeds: $('#supportNeeds').value.trim(),
      additionalNotes: $('#additionalNotes').value.trim()
    };
  }

  function validateStep1() {
    if (!els.schoolLevel.value) return '학교급을 선택해 주세요.';
    if (!els.gradeSelect.value) return '학년을 선택해 주세요.';
    const type = els.planTypes.find((input) => input.checked)?.value;
    if (!type) return '작성 유형을 선택해 주세요.';
    if (type === 'subject' && !els.subjectSelect.value) return '교과를 선택해 주세요.';
    if (type === 'life' && selectedLifeAreas().length === 0) return '생활기능 영역을 1개 이상 선택해 주세요.';
    return '';
  }

  function validateStep2(payload) {
    const checks = [
      ['currentLevel', '현행 수준'],
      ['semesterGoalDraft', '학기 목표 초안'],
      ['studentParentNeeds', '학생 및 학부모 요구'],
      ['strengthsInterests', '학생 강점 및 흥미'],
      ['supportNeeds', '지원이 필요한 사항']
    ];
    for (const [key, label] of checks) {
      if (!payload[key]) return `${label}을(를) 입력해 주세요.`;
    }
    if (payload.planType === 'subject' && payload.selectedStandards.length === 0) return '관련 성취기준을 1개 이상 선택해 주세요.';
    if (payload.planType === 'life' && payload.lifeScenes.length === 0) return '기능을 사용할 주요 생활 장면을 1개 이상 선택해 주세요.';

    const sensitive = scanSensitiveData(Object.values(payload).flat(Infinity).join(' '));
    if (sensitive.length) return `${sensitive.join(', ')}로 보이는 정보가 있습니다. 비식별화한 뒤 다시 시도해 주세요.`;
    return '';
  }

  function showFormMessage(message) {
    els.formMessage.textContent = message;
    els.formMessage.classList.toggle('hidden', !message);
  }

  function buildReviewSummary(payload) {
    const standardText = payload.planType === 'subject'
      ? payload.selectedStandards.map((item) => `[${item.code}] ${item.description}`).join('\n')
      : `${payload.selectionName}${payload.lifeAdaptationDetail ? ` · ${payload.lifeAdaptationDetail}` : ''}\n생활 장면: ${payload.lifeScenes.join(', ')}`;
    const items = [
      ['기본 설정', `${payload.schoolLevelLabel} ${payload.grade} · ${payload.semester} · ${payload.planTypeLabel} · ${payload.selectionName}`],
      ['교육과정·영역 연계', standardText],
      ['현행 수준', payload.currentLevel],
      ['학기 목표 초안', payload.semesterGoalDraft],
      ['학생 및 학부모 요구', payload.studentParentNeeds],
      ['강점·흥미와 지원', `${payload.strengthsInterests}\n지원: ${payload.supportNeeds}`]
    ];
    els.reviewSummary.innerHTML = items.map(([title, content]) => `<div class="review-item"><b>${escapeHtml(title)}</b><p>${escapeHtml(content)}</p></div>`).join('');
  }

  function renderResult(result) {
    const goal = result.semesterGoal || {};
    const smart = goal.smartCheck || {};
    const content = Array.isArray(result.educationContent) ? result.educationContent : [];
    const methods = Array.isArray(result.educationMethods) ? result.educationMethods : [];
    const evaluation = result.evaluationPlan || {};
    const indicators = Array.isArray(evaluation.indicators) ? evaluation.indicators : [];

    const editableAt = (path, value) => `data-editable data-path="${path}">${escapeHtml(value || '')}`;

    els.resultContent.innerHTML = `
      <section class="result-block">
        <h3>1. 학기 목표</h3>
        <div class="result-body editable">
          <p class="goal-statement" ${editableAt('semesterGoal.statement', goal.statement)}</p>
          <p class="reflection"><b>요구 반영:</b> <span ${editableAt('semesterGoal.reflectionOfNeeds', goal.reflectionOfNeeds)}</span></p>
          <div class="smart-grid">
            ${[
              ['S · 구체성', 'specific'], ['M · 측정 가능성', 'measurable'],
              ['A · 달성 가능성', 'achievable'], ['R · 관련성', 'relevant'], ['T · 기한', 'timeBound']
            ].map(([label, key]) => `<div class="smart-item"><b>${label}</b><span ${editableAt(`semesterGoal.smartCheck.${key}`, smart[key])}</span></div>`).join('')}
          </div>
          <h4>단계 목표</h4>
          <ol class="phase-list">${(goal.phasedObjectives || []).map((item, i) => `<li ${editableAt(`semesterGoal.phasedObjectives.${i}`, item)}</li>`).join('')}</ol>
        </div>
      </section>

      <section class="result-block">
        <h3>2. 교육내용</h3>
        <div class="result-body editable">
          <table class="result-table">
            <thead><tr><th>단계/기간</th><th>핵심 내용</th><th>구체적 활동</th><th>교육과정·영역 연결</th></tr></thead>
            <tbody>${content.map((item, i) => `<tr><td ${editableAt(`educationContent.${i}.sequence`, item.sequence)}</td><td ${editableAt(`educationContent.${i}.focus`, item.focus)}</td><td><ul>${(item.activities || []).map((a, j) => `<li ${editableAt(`educationContent.${i}.activities.${j}`, a)}</li>`).join('')}</ul></td><td ${editableAt(`educationContent.${i}.curriculumConnection`, item.curriculumConnection)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </section>

      <section class="result-block">
        <h3>3. 교육방법</h3>
        <div class="result-body editable method-grid">
          ${methods.map((item, i) => `<article class="method-card"><h4 ${editableAt(`educationMethods.${i}.strategy`, item.strategy)}</h4><dl><dt>적용 방법</dt><dd ${editableAt(`educationMethods.${i}.application`, item.application)}</dd><dt>지원</dt><dd ${editableAt(`educationMethods.${i}.supports`, item.supports)}</dd><dt>유의점</dt><dd ${editableAt(`educationMethods.${i}.caution`, item.caution)}</dd></dl></article>`).join('')}
        </div>
      </section>

      <section class="result-block">
        <h3>4. 평가계획 및 초점</h3>
        <div class="result-body editable evaluation-grid">
          <aside class="eval-side"><h4>평가 초점</h4><ul class="focus-list">${(evaluation.focuses || []).map((item, i) => `<li ${editableAt(`evaluationPlan.focuses.${i}`, item)}</li>`).join('')}</ul><h4>기록 도구</h4><div class="tag-row">${(evaluation.recordingTools || []).map((item, i) => `<span class="tag" ${editableAt(`evaluationPlan.recordingTools.${i}`, item)}</span>`).join('')}</div><div class="generalization"><b>유지·일반화</b><br><span ${editableAt('evaluationPlan.generalizationPlan', evaluation.generalizationPlan)}</span></div></aside>
          <div class="eval-main"><h4>평가 지표</h4><table class="result-table"><thead><tr><th>행동·기능</th><th>조건</th><th>기준</th><th>방법</th><th>시기</th></tr></thead><tbody>${indicators.map((item, i) => `<tr><td ${editableAt(`evaluationPlan.indicators.${i}.behavior`, item.behavior)}</td><td ${editableAt(`evaluationPlan.indicators.${i}.condition`, item.condition)}</td><td ${editableAt(`evaluationPlan.indicators.${i}.criterion`, item.criterion)}</td><td ${editableAt(`evaluationPlan.indicators.${i}.method`, item.method)}</td><td ${editableAt(`evaluationPlan.indicators.${i}.timing`, item.timing)}</td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>

      <section class="result-block">
        <h3>5. 교사 최종 검토 사항</h3>
        <div class="result-body editable"><ul class="review-list">${(result.teacherReview || []).map((item, i) => `<li ${editableAt(`teacherReview.${i}`, item)}</li>`).join('')}</ul></div>
      </section>`;
  }

  function syncEditsToState() {
    if (!state.result) return;
    $$('[data-path]').forEach((node) => {
      const parts = node.dataset.path.split('.');
      let target = state.result;
      for (let i = 0; i < parts.length - 1; i += 1) {
        target = target?.[parts[i]];
        if (target == null) return;
      }
      target[parts[parts.length - 1]] = node.innerText.trim();
    });
  }

  function resultAsText() {
    return els.resultContent.innerText.replace(/\n{3,}/g, '\n\n').trim();
  }

  async function generatePlan() {
    const payload = collectPayload();
    const error = validateStep2(payload);
    if (error) {
      els.apiMessage.textContent = error;
      els.apiMessage.classList.remove('hidden');
      return;
    }

    els.apiMessage.classList.add('hidden');
    els.generateBox.classList.add('hidden');
    els.resultSection.classList.add('hidden');
    els.regenerateBtn.classList.add('hidden');
    els.loadingState.classList.remove('hidden');
    els.generateBtn.disabled = true;

    const messages = [
      ['현행 수준과 요구를 분석하고 있습니다.', '학생의 강점과 지원 요구를 교육 목표에 연결하는 중입니다.'],
      ['SMART 목표를 점검하고 있습니다.', '조건·행동·기준·기한이 분명한지 확인하는 중입니다.'],
      ['교육내용과 평가를 연결하고 있습니다.', '수업, 평가, 기록, 일반화가 일관되도록 구성하는 중입니다.']
    ];
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % messages.length;
      [els.loadingTitle.textContent, els.loadingMessage.textContent] = messages[index];
    }, 1600);

    try {
      const response = await fetch('/api/generate-iep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '계획 생성에 실패했습니다.');

      state.result = body.result;
      state.resultMeta = { mode: body.mode, model: body.model, generatedAt: new Date().toISOString() };
      state.inputSnapshot = payload;
      els.resultSection.classList.remove('editing');
      $('#editResultBtn').textContent = '편집 모드';
      renderResult(body.result);
      els.modeBadge.textContent = body.mode === 'demo' ? '데모 결과 · API 미호출' : `AI 생성 · ${body.model}`;
      els.modeBadge.classList.toggle('demo', body.mode === 'demo');
      els.resultSection.classList.remove('hidden');
      els.regenerateBtn.classList.remove('hidden');
      showToast('개별화교육계획 초안이 생성되었습니다.');
    } catch (error) {
      els.apiMessage.textContent = error.message;
      els.apiMessage.classList.remove('hidden');
      els.generateBox.classList.remove('hidden');
    } finally {
      clearInterval(timer);
      els.loadingState.classList.add('hidden');
      els.generateBtn.disabled = false;
    }
  }

  els.schoolLevel.addEventListener('change', () => {
    state.schoolLevel = els.schoolLevel.value;
    populateGrades();
    updateSelectionControls();
  });
  els.planTypes.forEach((input) => input.addEventListener('change', updateSelectionControls));
  els.subjectSelect.addEventListener('change', () => { state.selectionName = els.subjectSelect.value; });
  els.lifeAreaList.addEventListener('change', () => {
    state.selectionName = lifeSelectionName();
    updateLifeAreaInfo();
  });
  els.adaptationDetail.addEventListener('change', () => { state.lifeAdaptationDetail = els.adaptationDetail.value; });
  els.gradeSelect.addEventListener('change', () => {
    if (state.planType === 'subject') populateSubjects();
  });
  els.standardsList.addEventListener('change', updateStandardCount);

  $('#goStep2').addEventListener('click', () => {
    const error = validateStep1();
    if (error) return showToast(error);
    state.schoolLevel = els.schoolLevel.value;
    state.planType = els.planTypes.find((input) => input.checked).value;
    state.selectionName = state.planType === 'subject' ? els.subjectSelect.value : lifeSelectionName();
    state.lifeAdaptationDetail = state.planType === 'life' && selectedLifeAreas().some((area) => area.id === 'life_adaptation')
      ? els.adaptationDetail.value : '';
    buildContextSummary();
    els.subjectStandardSection.classList.toggle('hidden', state.planType !== 'subject');
    els.lifeSceneSection.classList.toggle('hidden', state.planType !== 'life');
    if (state.planType === 'subject') populateStandards();
    setStep(2);
  });

  $('#backStep1').addEventListener('click', () => setStep(1));
  $('#goStep3').addEventListener('click', () => {
    const payload = collectPayload();
    const error = validateStep2(payload);
    showFormMessage(error);
    if (error) return;
    buildReviewSummary(payload);
    setStep(3);
  });
  $('#backStep2').addEventListener('click', () => setStep(2));
  els.generateBtn.addEventListener('click', generatePlan);
  els.regenerateBtn.addEventListener('click', generatePlan);

  $('#editResultBtn').addEventListener('click', (event) => {
    const editing = els.resultSection.classList.toggle('editing');
    $$('[data-editable]').forEach((node) => node.setAttribute('contenteditable', editing ? 'true' : 'false'));
    event.currentTarget.textContent = editing ? '편집 완료' : '편집 모드';
    if (!editing) {
      syncEditsToState();
      showToast('편집 내용을 적용했습니다. JSON 저장에도 반영됩니다.');
    }
  });

  $('#copyResultBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultAsText());
      showToast('전체 내용을 복사했습니다.');
    } catch (_) {
      showToast('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.');
    }
  });

  $('#downloadResultBtn').addEventListener('click', () => {
    if (!state.result) return;
    syncEditsToState();
    const inputSummary = { ...(state.inputSnapshot || collectPayload()) };
    delete inputSummary.sessionId;
    const payload = { meta: state.resultMeta, inputSummary, result: state.result };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `IEP_${state.selectionName}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('#printResultBtn').addEventListener('click', () => window.print());

  $$('.step').forEach((button) => button.addEventListener('click', () => {
    const target = Number(button.dataset.stepTarget);
    if (target <= state.step) setStep(target);
  }));

  $$('textarea').forEach((textarea) => {
    const counter = $(`.char-count[data-for="${textarea.id}"]`);
    const update = () => { if (counter) counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`; };
    textarea.addEventListener('input', update);
    update();
  });

  populateLifeAreas();
  updateSelectionControls();
})();
