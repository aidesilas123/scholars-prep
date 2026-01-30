/* cbt-app.js — full CBT app script (externalized)
   Paste this file in the same folder as cbt.html and then update cbt.html to load it.
*/

'use strict';

/* ---------- Config ---------- */
const BACKEND_BASE = 'https://my-app-backend-kjep.onrender.com'; // change to your backend base URL if different

/* ---------- Demo bank (kept empty as fallback) ----------
   You can leave these mostly empty because we'll fetch from backend.
   Keep the keys so course grid renders. */
const QUESTION_BANK = {
  MATH102EXAM: [], MATH102TEST: [],
  STAT102EXAM: [], STAT102TEST: [],
  MATH106EXAM: [], MATH106TEST: [],
  MATH104EXAM: [], MATH104TEST: [],
  MATH103EXAM: [], MATH103TEST: [],
  MATH101EXAM: [], MATH101TEST: [],
  MATH105EXAM: [], MATH105TEST: [],
  GEOG102EXAM: [], GEOG102TEST: [],
  GEOG104EXAM: [], GEOG104TEST: [],
  GEOG106EXAM: [], GEOG106TEST: [],
  GEOG101EXAM: [], GEOG101TEST: [],
  GEOG103EXAM: [], GEOG103TEST: [],
  GENS101EXAM: [], GENS101TEST: [],
  GENS103EXAM: [], GENS103TEST: [],
  GENS102EXAMS: [], GENS102TEST: [],
  GENS104EXAMS: [], GENS104TEST: [],
  COSC101EXAM: [], COSC101TEST: [],
  BIOL112EXAM: [], BIOL112TEST: [],
  PHYS112EXAM: [], PHYS112TEST: []
};

/* ---------- State ---------- */
let selectedCourse = null;
let selectedYear = null;
let durationSec = 0;
let totalQuestions = 0;
let timerId = null;
let currentIndex = 0;
let questions = []; // [{q, opts, ans}, ...]
let answers = [];   // user selected answer indexes
let flags = [];     // booleans

/* ---------- Utils ---------- */
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}
function getAccessToken(){
  return localStorage.getItem('accessToken') || localStorage.getItem('abupq_access') || null;
}

/* Neutralize global demo arrays if present (defensive) */
function neutralizeDemoGlobals(names = []) {
  names.forEach(n => {
    try { if (window[n] && Array.isArray(window[n])) window[n].length = 0; } catch(e){}
  });
}

/* ---------- DOM helpers ---------- */
function $(id){ return document.getElementById(id); }

/* ---------- Modal ---------- */
function showModal(title, msg, onOk){
  $('modalTitle').textContent = title;
  $('modalMsg').textContent = msg;
  const ok = $('modalOk');
  ok.onclick = ()=>{ hideModal(); if(typeof onOk === 'function') onOk(); };
  $('overlay').style.display = 'flex';
}
function hideModal(){ $('overlay').style.display = 'none'; }

/* ---------- Calculator simple functions (same as inline page) ---------- */
function toggleCalc(){ const el = $('calc'); el.style.display = (el.style.display==='none' || !el.style.display) ? 'block' : 'none'; }
function ins(ch){ const el = $('calcInput'); el.value += ch; }
function clr(){ $('calcInput').value=''; $('calcOut').textContent='—'; }
function del1(){ const el = $('calcInput'); el.value = el.value.slice(0,-1); }
function evalCalc(){
  const raw = $('calcInput').value.trim();
  if(!/^[0-9+\-*/().\s%^]+$/.test(raw)){ $('calcOut').textContent='Invalid'; return; }
  const expr = raw.replace(/\^/g,'**');
  try{
    const val = Function('"use strict";return('+expr+')')();
    $('calcOut').textContent = String(val);
  }catch(e){ $('calcOut').textContent='Error'; }
}

/* ---------- Build UI: years, course grid ---------- */
function populateYearSelect(){
  const yearSel = $('year');
  yearSel.innerHTML = '';
  const nowY = new Date().getFullYear();
  for(let y=nowY; y>=2015; y--){
    const opt = document.createElement('option'); opt.value=String(y); opt.textContent=String(y);
    yearSel.appendChild(opt);
  }
}

/* Build course cards from QUESTION_BANK keys */
function buildCourseGrid(){
  const courseGrid = $('courseGrid');
  courseGrid.innerHTML = '';
  Object.keys(QUESTION_BANK).forEach(name=>{
    const d = document.createElement('div');
    d.className='course';
    d.innerHTML = `<div style="font-weight:800; font-size:18px">${name}</div>
                   <div style="font-size:12px; color:var(--muted)">Questions available: ${QUESTION_BANK[name].length}</div>`;
    d.onclick = ()=> chooseCourse(name);
    courseGrid.appendChild(d);
  });
}

/* choose course (called when user clicks a card) */
function chooseCourse(name){
  selectedCourse = name;
  $('stepCourse').style.display='none';
  $('stepSettings').style.display='block';
}

/* UI navigate back */
function goBackToCourses(){
  selectedCourse = null;
  $('stepSettings').style.display='none';
  $('stepCourse').style.display='block';
}

/* ---------- Timer ---------- */
function updateTimerLabel(){
  const m = Math.floor(Math.max(0,durationSec)/60).toString().padStart(2,'0');
  const s = (Math.max(0,durationSec)%60).toString().padStart(2,'0');
  $('timer').textContent = `${m}:${s}`;
}
function startTimer(){
  updateTimerLabel();
  if(timerId) clearInterval(timerId);
  timerId = setInterval(()=>{
    durationSec--;
    if(durationSec<=0){
      clearInterval(timerId);
      doSubmit(true);
    }
    updateTimerLabel();
  },1000);
}

/* ---------- Grid + render ---------- */
function buildQGrid(){
  const grid = $('qGrid');
  grid.innerHTML = '';
  for(let i=0;i<totalQuestions;i++){
    const b=document.createElement('button');
    b.className='qbtn';
    b.textContent= i+1;
    b.onclick = ()=> gotoQ(i);
    if(answers[i]!=null) b.classList.add('answered');
    if(flags[i]) b.classList.add('flag');
    if(i===currentIndex) b.classList.add('current');
    grid.appendChild(b);
  }
  updateAnsweredCount();
}
function updateAnsweredCount(){ $('answeredCount').textContent = answers.filter(v=>v!=null).length; }

function renderQuestion(){
  const q = questions[currentIndex];
  if(!q){
    $('qText').textContent = 'No question to display';
    $('qOptions').innerHTML = '';
    return;
  }
  $('qText').textContent = `${currentIndex+1}. ${q.q || q.question || ''}`;
  const opts = q.opts || q.options || [];
  $('qOptions').innerHTML = opts.map((t,idx=>{
    const checked = answers[currentIndex]===idx ? 'checked' : '';
    return `<label class="opt"><input type="radio" name="opt" value="${idx}" ${checked}> ${escapeHtml(t)}</label>`;
  })).join('');
  buildQGrid();
  // attach listeners
  $('qOptions').querySelectorAll('input[name="opt"]').forEach(inp=>{
    inp.addEventListener('change', e=>{
      answers[currentIndex] = parseInt(e.target.value,10);
      buildQGrid();
    });
  });
}
function gotoQ(i){ currentIndex=i; renderQuestion(); }
function prevQ(){ if(currentIndex>0){ currentIndex--; renderQuestion(); } }
function nextQ(){ if(currentIndex<totalQuestions-1){ currentIndex++; renderQuestion(); } }
function toggleFlag(){ flags[currentIndex] = !flags[currentIndex]; buildQGrid(); }

/* ---------- Submit + Review ---------- */
function confirmSubmit(){ showModal('Submit Exam','Are you sure you want to submit? You cannot change answers after submission.', ()=> doSubmit(false)); }
function doSubmit(auto=false){
  if(timerId) clearInterval(timerId);
  let score=0;
  questions.forEach((q,i)=>{ if(answers[i]===q.ans) score++; });
  $('stepExam').style.display='none';
  $('stepResult').style.display='block';
  $('scoreLine').innerHTML = `${auto? '⏰ Time up — ':''}You scored <strong>${score}</strong> out of <strong>${totalQuestions}</strong>.`;
  hideModal();
}
function showReview(){
  const list = $('reviewList');
  list.innerHTML = questions.map((q,i)=>{
    const userIdx = answers[i];
    const ok = userIdx===q.ans;
    const your = userIdx==null ? '<em>No answer</em>' : escapeHtml((q.opts||q.options||[])[userIdx]||'');
    const correct = escapeHtml((q.opts||q.options||[])[q.ans] || '');
    return `<div class="card" style="background:rgba(255,255,255,0.1)">
      <div style="font-weight:700; margin-bottom:6px">Q${i+1}: ${escapeHtml(q.q||q.question||'')}</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap">
        <div class="pill" style="background:${ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}; border:1px solid ${ok?'#10b981':'#ef4444'}">
          ${ok?'Correct':'Wrong'}
        </div>
        <div>Your answer: <strong>${your}</strong></div>
        <div>Correct: <strong>${correct}</strong></div>
      </div>
    </div>`;
  }).join('');
  $('stepResult').style.display='none';
  $('stepReview').style.display='block';
}
function backToResults(){ $('stepReview').style.display='none'; $('stepResult').style.display='block'; }

/* ---------- Backend fetching with normalization & fallback ---------- */
async function fetchQuestionsForCourse(selectedCourseName, selectedYear, desiredCount) {
  // selectedCourseName: e.g. "MATH102EXAM" or "MATH102TEST"
  // normalize to backend param: course=MATH102, type=exam/test
  const name = String(selectedCourseName || '').toUpperCase();
  const courseId = name.replace(/(EXAM|TEST)$/i, '');
  const type = /TEST$/i.test(name) ? 'test' : 'exam';
  const url = `${BACKEND_BASE}/cbt?course=${encodeURIComponent(courseId)}&type=${encodeURIComponent(type)}${selectedYear ? '&year=' + encodeURIComponent(selectedYear) : ''}`;
  try {
    const token = getAccessToken();
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) throw new Error('Backend error ' + res.status);
    const payload = await res.json();
    const rawQuestions = Array.isArray(payload.questions) ? payload.questions.slice() : [];
    const normalized = rawQuestions.map(it => {
      const questionText = it.question ?? it.q ?? '';
      const opts = it.options ?? it.opts ?? it.choices ?? [];
      let ansIndex = null;
      if (typeof it.answerIndex === 'number') ansIndex = it.answerIndex;
      else if (typeof it.ans === 'number') ansIndex = it.ans;
      else if (typeof it.answer === 'number') ansIndex = it.answer;
      else if (typeof it.answerLetter === 'string' && /^[A-Z]$/i.test(it.answerLetter)){
        ansIndex = it.answerLetter.toUpperCase().charCodeAt(0) - 65;
      }
      return { q: questionText, opts: opts, ans: (typeof ansIndex === 'number' ? ansIndex : null) };
    });
    shuffle(normalized);
    return normalized.slice(0, Math.max(0, desiredCount || normalized.length));
  } catch(err){
    console.warn('fetchQuestionsForCourse failed — falling back to QUESTION_BANK:', err);
    // fallback to local bank
    const local = (QUESTION_BANK[selectedCourseName] || []).slice();
    shuffle(local);
    // normalize local entries into {q, opts, ans}
    const normalizedLocal = local.map(it => ({ q: it.q ?? it.question ?? '', opts: it.opts ?? it.options ?? [], ans: (typeof it.ans === 'number' ? it.ans : null) }));
    return normalizedLocal.slice(0, Math.max(0, desiredCount || normalizedLocal.length));
  }
}

/* ---------- Replacement START flow (async) ----------
   This function tries backend first then falls back automatically.
*/
async function startExam(){
  if(!selectedCourse) return;

  selectedYear = $('year').value;
  durationSec = parseInt($('duration').value,10) * 60;
  totalQuestions = parseInt($('qcount').value,10);

  // UI: show loading exam screen while fetching
  $('stepSettings').style.display = 'none';
  $('stepExam').style.display = 'block';
  $('courseLabel').textContent = selectedCourse;
  $('yearLabel').textContent = selectedYear;
  $('qText').textContent = 'Loading questions…';
  $('qOptions').innerHTML = '';

  // neutralize old global arrays if any
  neutralizeDemoGlobals(Object.keys(QUESTION_BANK));

  // fetch
  const fetched = await fetchQuestionsForCourse(selectedCourse, selectedYear, totalQuestions);

  if (!Array.isArray(fetched) || fetched.length === 0) {
    // nothing returned — go back to settings and show modal
    $('stepExam').style.display = 'none';
    $('stepSettings').style.display = 'block';
    showModal('No questions', 'No questions found for this course/year. Try another year or contact admin.', ()=>hideModal());
    return;
  }

  // use fetched as questions set
  questions = fetched.slice(0);
  totalQuestions = questions.length;
  answers = Array(totalQuestions).fill(null);
  flags = Array(totalQuestions).fill(false);
  currentIndex = 0;

  // update UI labels
  $('courseLabel').textContent = selectedCourse;
  $('yearLabel').textContent = selectedYear;
  $('totalCount').textContent = totalQuestions;

  buildQGrid();
  renderQuestion();
  startTimer();
}

/* ---------- Page init (hydrate watermark, build UI) ---------- */
function hydrateFromLocal(){
  try {
    const obj = JSON.parse(localStorage.getItem('abupq_logged_in_user')||'null');
    const user = (obj && obj.email) ? obj.email : (localStorage.getItem('userEmail') || 'user@example.com');
    const wm = $('wmText'); if(wm) wm.textContent = user;
    const tag = $('userTag'); if(tag) tag.textContent = user;
  } catch(e){}
}

function highlightActiveTopbarLink(){ // optional if you use topbar nav
  try {
    const here = location.pathname.split('/').pop();
    document.querySelectorAll('.topbar nav a').forEach(a=>{
      const href = a.getAttribute('href');
      if(href && here && href === here) a.classList.add('active');
    });
  }catch(e){}
}

/* If user opened the page with query params (cbt.html?course=MATH102&type=exam&year=2019),
   we auto-select and start the exam (nice for direct links). */
async function autoStartIfUrlParams(){
  const qs = new URLSearchParams(window.location.search);
  const course = (qs.get('course') || qs.get('c') || '').toUpperCase();
  const type   = (qs.get('type') || qs.get('t') || '').toLowerCase();
  const year   = (qs.get('year') || qs.get('y') || '');

  if (!course || !type) return; // nothing to auto start

  // build selectedCourse key e.g. MATH102 + 'EXAM' => 'MATH102EXAM'
  const courseKey = course + (type === 'test' ? 'TEST' : 'EXAM');

  // If courseKey doesn't exist in QUESTION_BANK, still set it so UI displays label.
  if (!QUESTION_BANK.hasOwnProperty(courseKey)) {
    // create entry so the grid function can show it (optional)
    QUESTION_BANK[courseKey] = [];
  }

  // set selection and pre-select year if provided
  selectedCourse = courseKey;
  if (year) {
    const ysel = $('year');
    if (ysel) ysel.value = String(year);
  }

  // directly start the exam (bypass the course & settings steps)
  // Make sure DOM is ready
  await startExam();
}

/* ---------- Client-side protections (deterrents) ---------- */
function attachProtections(){
  document.addEventListener('contextmenu', e=> e.preventDefault());
  document.addEventListener('keydown', e=>{
    const c = e.ctrlKey || e.metaKey;
    if(c && ['c','x','s','p','u','a'].includes(e.key.toLowerCase())) e.preventDefault();
    if(e.key==='PrintScreen' || e.code==='PrintScreen'){ e.preventDefault(); showModal('Blocked','Screenshots are restricted in this demo.', hideModal); }
  });
  document.addEventListener('selectstart', e=>{
    if(['INPUT','TEXTAREA'].includes((e.target.tagName||''))) return;
    e.preventDefault();
  });
}

/* ---------- Wire global functions for buttons that use inline onclick attributes in HTML ---------- */
function wireGlobals(){
  window.goBackToCourses = goBackToCourses;
  window.startExam = startExam;
  window.prevQ = prevQ;
  window.nextQ = nextQ;
  window.toggleFlag = toggleFlag;
  window.confirmSubmit = confirmSubmit;
  window.showReview = showReview;
  window.backToResults = backToResults;
  window.toggleCalc = toggleCalc;
  window.ins = ins; window.clr = clr; window.del1 = del1; window.evalCalc = evalCalc;
}

/* ---------- Initialization on DOMContentLoaded ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  hydrateFromLocal();
  populateYearSelect();
  buildCourseGrid();
  attachProtections();
  wireGlobals();
  highlightActiveTopbarLink();
  // Optionally try to auto-start if URL provides course/type (handy for direct links)
  await autoStartIfUrlParams();
});

/* ---------- Login protection (move into external js to centralize) ---------- */
(function protectPage(){
  try {
    const logged = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
    if (!logged || !logged.email) {
      // if current page is login.html do nothing, else redirect
      if (!/login\.html$/i.test(location.pathname.split('/').pop())) {
        window.location.href = "login.html";
      }
    }
  } catch(e){}
})();
