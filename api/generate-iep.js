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

[생성 절차]
출력 순서는 아래 JSON 형식 그대로 두되, 내용을 만들 때는 다음 순서로 생각하십시오.
1) 학기 목표를 확정한다.
2) 그 목표를 난이도 순으로 쪼개어 평가 초점을 먼저 정한다.
3) 각 평가 초점에 도달하는 데 필요한 것을 교육 내용으로 쓴다.
4) 그 교육 내용을 지도하는 방법을 교육 방법으로 쓴다.
학기 목표, 평가 초점, 교육 내용, 교육 방법은 같은 용어를 사용하여 서로 맞물리게 하십시오.
목표에 없던 활동이나 개념을 뒤에서 새로 끌어들이지 마십시오.

[서술 방식]
- "예:"를 쓰지 마십시오. 사례를 들 때는 나열한 뒤 끝에 "등"을 붙이십시오.
- 괄호는 같은 말을 겹쳐 적을 때와 짧은 어구를 나열할 때만 쓰십시오. 설명을 덧붙이는 용도로 쓰지 마십시오.
- 중간점은 두 낱말을 한 덩어리로 묶을 때만 쓰십시오. 여러 항목을 잇는 데 쓰지 마십시오.
- 한 항목 안에 여러 내용을 기호로 이어 붙이지 말고 항목을 나누십시오.

[항목별 서술 규칙]
학기 목표(semesterGoal.statement)
- 한 문장으로 쓰고 "~한다"로 끝냅니다.

단계 목표(semesterGoal.phasedObjectives)
- "~한다"로 끝내고, 쉬운 것부터 어려운 것 순으로 배열합니다.

교육 내용(educationContent.activities)
- 학생이 배울 내용을 중심으로 쓰고, 모든 항목을 "~하기"로 끝냅니다.
- 교사의 행위나 지도 전략은 쓰지 않습니다.
- 평가 초점의 배열 순서를 따라갑니다.
- 마지막 단계의 마지막 항목은 배운 것을 일상생활에서 활용하는 활동으로 마무리합니다.

교육 방법(educationMethods)
- strategy에는 전략의 이름만 짧게 적습니다.
- application에는 어떤 상황에서 교사가 무엇을 보여주고 학생이 어떻게 반응하게 할 것인지까지 씁니다. 한 줄로 끊지 말고 두세 절로 쓰며 "~하게 한다" 또는 "~한다"로 끝냅니다.
- 전략의 이름을 다시 적는 것으로 application을 대신하지 마십시오.
- supports와 caution은 한 문장으로 간결하게 씁니다.

평가 초점(evaluationPlan.focuses)
- 모든 항목을 "~할 수 있는가?" 형태의 물음으로 씁니다.
- 3~5개를 쓰고, 쉬운 것부터 어려운 것 순으로 배열합니다.
- 앞 항목이 뒤 항목의 밑바탕이 되게 합니다.
- 학기 목표를 그대로 되풀이하지 말고, 목표에 이르는 중간 단계를 드러내어 나눕니다.

교사 검토 사항(teacherReview)
- 교사가 실제로 확인하거나 고쳐야 할 것을 한 문장으로 씁니다.

[문장 길이]
교육 방법의 application을 제외한 나머지 항목은 간결하게 씁니다.
교육 방법만 상황과 방법이 함께 드러나도록 충분히 서술하십시오.

[출력 형식]
아래 JSON만 출력하십시오. 설명, 머리말, 마크다운 코드펜스를 붙이지 마십시오.

{
  "semesterGoal": {
    "statement": "학기 목표 한 문장, ~한다로 끝냄",
    "reflectionOfNeeds": "학생·학부모 요구가 반영된 지점",
    "smartCheck": { "specific": "", "measurable": "", "achievable": "", "relevant": "", "timeBound": "" },
    "phasedObjectives": ["단계 목표 3~4개, 난이도 순"]
  },
  "educationContent": [
    { "sequence": "1단계 (3~4월)", "focus": "핵심 내용", "activities": ["~하기 형태의 활동 2~4개"], "curriculumConnection": "교육과정·영역 연결" }
  ],
  "educationMethods": [
    { "strategy": "전략명", "application": "상황과 방법을 두세 절로 서술", "supports": "필요한 지원", "caution": "유의점" }
  ],
  "evaluationPlan": {
    "focuses": ["~할 수 있는가? 형태의 평가 초점 3~5개, 난이도 순"],
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
        max_tokens: 8000,
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

    let text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    text = text.replace(/```json|```/g, '').trim();

    if (data.stop_reason === 'max_tokens') {
      console.error('Truncated output. usage:', JSON.stringify(data.usage));
      return res.status(502).json({ error: '생성 결과가 너무 길어 중간에 끊겼습니다. 입력을 조금 줄이고 다시 생성해 주세요. (E-TRUNC)' });
    }

    // 앞뒤에 군더더기가 붙은 경우 중괄호 구간만 잘라냄
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) text = text.slice(first, last + 1);

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON parse failed. stop_reason:', data.stop_reason);
      console.error('raw head:', text.slice(0, 800));
      console.error('raw tail:', text.slice(-400));
      return res.status(502).json({ error: '생성 결과의 형식이 올바르지 않습니다. 다시 생성해 주세요. (E-PARSE)' });
    }

    if (!result.semesterGoal) {
      console.error('Missing semesterGoal. keys:', Object.keys(result));
      return res.status(502).json({ error: '생성 결과에 필수 항목이 없습니다. 다시 생성해 주세요. (E-SHAPE)' });
    }

    return res.status(200).json({ mode: 'ai', model: MODEL, result });
  } catch (err) {
    console.error('generate-iep failed:', err);
    return res.status(500).json({ error: '계획 생성 중 오류가 발생했습니다.' });
  }
}
