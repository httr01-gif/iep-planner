// PAIR IEP Builder - 서버리스 프록시
// 배포 위치: 저장소 최상위의 api/generate-iep.js
// 환경변수: ANTHROPIC_API_KEY (필수), IEP_MODEL (선택)

const MODEL = process.env.IEP_MODEL || 'claude-sonnet-5';

// 개인정보 차단 패턴 (프롬프트에 실려 나가기 전에 서버에서 한 번 더 거름)
const BLOCKED = [
  { re: /\d{6}\s*[-–]\s*[1-4]\d{6}/, label: '주민등록번호로 보이는 값' },
  { re: /01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}/, label: '휴대전화번호' },
  { re: /\b0(2|3[1-3]|4[1-4]|5[1-5]|6[1-4])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/, label: '전화번호' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, label: '이메일 주소' }
];

const SYSTEM_PROMPT = `당신은 대한민국 특수교육 개별화교육계획(IEP) 작성을 지원하는 전문 조력자입니다.
2022 개정 특수교육 기본 교육과정을 기준으로 하며, 교사가 검토·수정할 '초안'을 작성합니다.

[작성 원칙]
1. 입력된 현행 수준에 없는 학생 정보를 추측하거나 지어내지 마십시오. 정보가 부족한 부분은 교사 검토 사항으로 넘기십시오.
2. 학기 목표는 SMART 요건을 갖추되, 조건·행동·기준이 관찰과 측정이 가능한 문장이어야 합니다.
3. 교과형: 교과 내용을 학년 수준으로 낮춘 진도 목표가 아니라, 그 교과를 학습하는 데 필요한 기초학습기술·학습전략·과제수행기술 중심으로 작성하십시오. 선택된 성취기준은 목표 문장에 복사하지 말고 연계 근거로만 사용하십시오.
4. 생활기능 중심: 선택된 생활 장면에서 실제로 사용되는 기능으로 쓰고, 유지·일반화 계획을 반드시 포함하십시오.
5. 학생의 강점과 흥미를 교육방법에 구체적으로 연결하십시오.
6. 학부모·학생 요구가 목표에 어떻게 반영되었는지 명시하십시오.
7. 문장은 개조식 공문서체로 간결하게 작성하십시오.

[출력 형식]
아래 JSON만 출력하십시오. 설명, 머리말, 마크다운 코드펜스를 붙이지 마십시오.

{
  "semesterGoal": {
    "statement": "학기 목표 한 문장",
    "reflectionOfNeeds": "학생·학부모 요구가 반영된 지점",
    "smartCheck": { "specific": "", "measurable": "", "achievable": "", "relevant": "", "timeBound": "" },
    "phasedObjectives": ["단계 목표 3~4개"]
  },
  "educationContent": [
    { "sequence": "1단계 (3~4월)", "focus": "핵심 내용", "activities": ["구체적 활동 2~4개"], "curriculumConnection": "교육과정·영역 연결" }
  ],
  "educationMethods": [
    { "strategy": "전략명", "application": "적용 방법", "supports": "필요한 지원", "caution": "유의점" }
  ],
  "evaluationPlan": {
    "focuses": ["평가 초점 3~4개"],
    "recordingTools": ["기록 도구 3~5개"],
    "generalizationPlan": "유지·일반화 계획",
    "indicators": [
      { "behavior": "", "condition": "", "criterion": "", "method": "", "timing": "" }
    ]
  },
  "teacherReview": ["교사가 반드시 확인·수정해야 할 사항 4~6개"]
}

educationContent는 3~4개, educationMethods는 3~4개, indicators는 3~5개로 작성하십시오.`;

function buildUserPrompt(p) {
  const lines = [
    `학교급: ${p.schoolLevelLabel || ''} ${p.grade || ''}`,
    `학기: ${p.semester || ''}`,
    `작성 유형: ${p.planTypeLabel || ''}`,
    `대상: ${p.selectionName || ''}`,
    `학생 구분: ${p.studentAlias || '학생 A'}`
  ];

  if (p.planType === 'subject') {
    const std = (p.selectedStandards || [])
      .map((s) => `- ${s.code || ''} ${s.content || s.name || s}`)
      .join('\n');
    lines.push(`\n[선택한 성취기준]\n${std || '(선택 없음)'}`);
    lines.push(`\n[목표 작성 방향]\n${(p.subjectSkillDirections || []).join(', ')}`);
  } else {
    const areas = (p.selectedLifeAreas || [])
      .map((a) => `- ${a.name}: ${a.description || ''}`)
      .join('\n');
    lines.push(`\n[생활기능 영역]\n${areas || '(선택 없음)'}`);
    if (p.lifeAdaptationDetail) lines.push(`생활적응 세부 유형: ${p.lifeAdaptationDetail}`);
    lines.push(`\n[주요 생활 장면]\n${(p.lifeScenes || []).join(', ')}`);
  }

  lines.push(`\n[현행 수준]\n${p.currentLevel}`);
  lines.push(`\n[교사가 생각한 학기 목표 초안]\n${p.semesterGoalDraft}`);
  lines.push(`\n[학생 및 학부모 요구]\n${p.studentParentNeeds}`);
  lines.push(`\n[학생 강점 및 흥미]\n${p.strengthsInterests}`);
  lines.push(`\n[지원이 필요한 사항]\n${p.supportNeeds}`);
  if (p.additionalNotes) lines.push(`\n[추가 참고 사항]\n${p.additionalNotes}`);

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  // 외부에서 이 주소만 직접 호출하는 것을 1차 차단
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';
  if (host && referer && !referer.includes(host)) {
    return res.status(403).json({ error: '허용되지 않은 접근입니다.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const required = ['currentLevel', 'semesterGoalDraft', 'studentParentNeeds', 'strengthsInterests', 'supportNeeds'];
  for (const field of required) {
    if (!payload?.[field]) return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
  }

  // 개인정보 차단
  const joined = JSON.stringify(payload);
  for (const { re, label } of BLOCKED) {
    if (re.test(joined)) {
      return res.status(400).json({ error: `입력값에 ${label}가 포함되어 있습니다. 개인정보는 제거한 뒤 생성해 주세요.` });
    }
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(payload) }]
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('Anthropic API error:', upstream.status, detail);
      return res.status(502).json({ error: 'AI 생성 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      console.error('JSON parse failed:', text.slice(0, 500));
      return res.status(502).json({ error: '생성 결과의 형식이 올바르지 않습니다. 다시 생성해 주세요.' });
    }

    return res.status(200).json({ mode: 'ai', model: MODEL, result });
  } catch (err) {
    console.error('generate-iep failed:', err);
    return res.status(500).json({ error: '계획 생성 중 오류가 발생했습니다.' });
  }
}
