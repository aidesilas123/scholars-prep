/***********************
     * SUPABASE CONFIGURATION - FIXED
     ***********************/
    let supabaseClient;
    
    // Initialize Supabase safely
    (function initSupabase() {
      const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
      const supabaseKey = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
      
      // Always create a fresh client for this page
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialized:', !!supabaseClient);
    })();

    // --- ROBUST MATH FIXER ---
    // --- ROBUST MATH FIXER ---
    // --- FINAL ROBUST MATH FIXER ---
function fixMathText(text) {
  if (!text) return "";
  let fixed = text;

  // 1. Safe list of keywords (Removed "in" to prevent Chemistry text bugs)
  const mathWords = [
    // Calculus & Algebra
    "frac", "sqrt", "int", "lim", "sum", "prod", "infty", "times", "div", "pm", "cdot", "partial",
    // Trig & Log
    "sin", "cos", "tan", "csc", "sec", "cot", "log", "ln", "exp", "det",
    // Set Theory & Logic (Removed 'in' because it breaks English sentences)
    "cup", "cap", "notin", "subset", "subseteq", "forall", "exists", "empty", "union",
    // Arrows
    "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow", "implies",
    // Greek Letters
    "theta", "pi", "alpha", "beta", "gamma", "delta", "lambda", "mu", "sigma", "omega", "Delta", "Sigma", "Omega", "phi", "psi", "rho", "epsilon"
  ];

  // 2. Apply the fix with WORD BOUNDARIES (\b)
  // This prevents 'sin' from becoming 's\in'
  mathWords.forEach(word => {
      // Regex explanation:
      // (?<!\\) -> Lookbehind: Ensure it doesn't already have a backslash
      // \b      -> Word boundary (start of word)
      // word    -> The keyword
      // \b      -> Word boundary (end of word)
      const regex = new RegExp(`(?<!\\\\)\\b${word}\\b`, 'g');
      fixed = fixed.replace(regex, `\\${word}`);
  });

  // 3. Clean up accidental double backslashes
  fixed = fixed.replace(/\\\\/g, "\\");

  // 4. Auto-Wrap in math mode ONLY if it looks like math
  // Checks for:
  //  - Backslash commands
  //  - Math operators (=, ^, _, <, >)
  //  - BUT we skip wrapping if it looks like a long English sentence (contains many spaces)
  const isMathSymbol = /[\\][a-zA-Z]+/.test(fixed) || /[=^_{}<>]/.test(fixed);
  const hasDelimiters = fixed.includes("$") || fixed.includes("\\(") || fixed.includes("\\[");
  
  // Safety check: If it's very long and has few math symbols, don't wrap it blindly
  // (This helps prevent other text-squashing issues)
  const isLongText = fixed.length > 50 && !fixed.includes("="); 

  if (isMathSymbol && !hasDelimiters && !isLongText) {
      return `\\( ${fixed} \\)`;
  }
  
  return fixed;
}

// --- SMILES DRAWER SETUP ---
const smilesOptions = { 
    width: 250, 
    height: 250, 
    bondThickness: 1.5,
    fontSizeLarge: 6
};
let smilesDrawerInstance = null;

function parseSmilesTags(text) {
    if (!text) return { htmlText: "", smilesQueue: [] };
    let smilesQueue = [];
    const htmlText = text.replace(/\[SMILES:\s*(.*?)\s*\]/g, (match, smilesString) => {
        const canvasId = 'smiles-' + Math.random().toString(36).substr(2, 9);
        smilesQueue.push({ id: canvasId, smiles: smilesString });
        return `<canvas id="${canvasId}"></canvas>`;
    });
    return { htmlText, smilesQueue };
}

function drawMolecules(smilesQueue) {
    if (smilesQueue.length === 0) return;
    if (!smilesDrawerInstance) {
         smilesDrawerInstance = new SmilesDrawer.Drawer(smilesOptions);
    }
    smilesQueue.forEach(item => {
        SmilesDrawer.parse(item.smiles, function(tree) {
            smilesDrawerInstance.draw(tree, item.id, 'light', false);
        }, function (err) {
            console.error("Error drawing SMILES:", err);
        });
    });
}
// ---------------------------

    /***********************
     * STATE
     ***********************/
    let selectedCourse = null;
    let selectedCourseName = '';
    let selectedYear = null;
    let durationSec = 0;
    let totalQuestions = 0;
    let timerId = null;
    let currentIndex = 0;
    let questions = []; // [{q,opts,ans}]
    let answers = [];   // user index or null
    let flags = [];     // boolean

    /***********************
     * NEW FLOW FUNCTIONS
     ***********************/
    function showInstructionsFirst() {
      document.getElementById('stepInstructions').style.display = 'block';
      document.getElementById('stepCourse').style.display = 'none';
      document.getElementById('stepSettings').style.display = 'none';
      document.getElementById('stepExam').style.display = 'none';
      document.getElementById('stepResult').style.display = 'none';
      document.getElementById('stepReview').style.display = 'none';
    }

    // Make function globally available
    window.proceedToCourseSelection = function() {
      showLoading(true);
      setTimeout(() => {
        document.getElementById('stepInstructions').style.display = 'none';
        document.getElementById('stepCourse').style.display = 'block';
        loadCourses();
        showLoading(false);
      }, 500);
    };

    /***********************
     * INIT + Email watermark
     ***********************/
    document.addEventListener('DOMContentLoaded', function() {
      const user = (() => {
        try {
          const obj = JSON.parse(localStorage.getItem('abupq_logged_in_user')||'null');
          if (obj && obj.email) return obj.email;
        } catch(e){}
        return localStorage.getItem('userEmail') || 'user@example.com';
      })();
      document.getElementById('wmText').textContent = user;
      document.getElementById('userTag').textContent = user;

      // Fill year dropdown (e.g., 2015 → current)
      const yearSel = document.getElementById('year');
      const nowY = new Date().getFullYear();
      for(let y=nowY; y>=2020; y--){
        const opt=document.createElement('option'); opt.value=String(y); opt.textContent=String(y);
        yearSel.appendChild(opt);
      }

      // Show instructions first
      showInstructionsFirst();
    });

    /***********************
     * COURSE LOADING FROM SUPABASE
     ***********************/
    async function loadCourses() {
  const courseGrid = document.getElementById('courseGrid');
  courseGrid.innerHTML = '<div style="padding:20px; text-align:center;">Connecting to database...</div>';

  try {
    // Check if Supabase is actually ready
    if (!supabaseClient) {
      console.error('Supabase not initialized');
      // Attempt emergency re-init if it's missing
      const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // your key
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    }

    const { data: courses, error } = await supabaseClient
      .from('courses')
      .select('*')
      .order('code');

    if (error) throw error;

    if (!courses || courses.length === 0) {
      courseGrid.innerHTML = '<div class="network-error">No courses found in database.</div>';
      return;
    }

    courseGrid.innerHTML = '';
    const courseGroups = {};
    courses.forEach(course => {
      if (!courseGroups[course.code]) courseGroups[course.code] = [];
      courseGroups[course.code].push(course);
    });

    Object.keys(courseGroups).forEach(courseCode => {
      const courseGroup = courseGroups[courseCode];
      const examCourse = courseGroup.find(c => c.type === 'exam');
      const testCourse = courseGroup.find(c => c.type === 'test');
      
      const d = document.createElement('div');
      d.className = 'course';
      d.innerHTML = `
        <div style="font-weight:800; font-size:18px">${courseCode}</div>
        <div style="font-size:14px; margin:4px 0; color:var(--muted)">Select Exam Type:</div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          ${examCourse ? `<button class="btn" onclick="chooseCourse('${examCourse.id}', '${examCourse.name}', 'exam')">Exam</button>` : ''}
          ${testCourse ? `<button class="btn secondary" onclick="chooseCourse('${testCourse.id}', '${testCourse.name}', 'test')">Test</button>` : ''}
        </div>
      `;
      courseGrid.appendChild(d);
    });
    
  } catch (error) {
    console.error('App Error:', error);
    courseGrid.innerHTML = `
      <div class="network-error">
        <p>Unable to load courses.</p>
        <button class="btn" onclick="loadCourses()">Retry Connection</button>
      </div>`;
  }
}
    // Make chooseCourse globally available
    window.chooseCourse = async function(courseId, courseName, examType) { // Made Async
      showLoading(true);
      
      selectedCourse = courseId;
      selectedCourseName = courseName;
      
      // --- NEW: Fetch Years for this course ---
      const yearSelect = document.getElementById('year');
      yearSelect.innerHTML = '<option>Loading...</option>';

      try {
        const { data: yearsData, error } = await supabaseClient
          .from('questions')
          .select('year')
          .eq('course_id', courseId);

        if (error) throw error;

        // Get unique years and sort descending (2025, 2024...)
        const uniqueYears = [...new Set(yearsData.map(y => y.year))].sort((a,b) => b-a);
        
        yearSelect.innerHTML = '';
        if(uniqueYears.length === 0) {
           const opt = document.createElement('option');
           opt.text = "No Questions Available for the selected Year";
           yearSelect.appendChild(opt);
        } else {
           uniqueYears.forEach(y => {
             const opt = document.createElement('option');
             opt.value = y;
             opt.textContent = y;
             yearSelect.appendChild(opt);
           });
        }

        document.getElementById('stepCourse').style.display = 'none';
        document.getElementById('stepSettings').style.display = 'block';

      } catch(e) {
        console.error(e);
        alert("Could not load years for this course.");
      } finally {
        showLoading(false);
      }
    };

    window.goBackToCourses = function(){
      showLoading(true);
      setTimeout(() => {
        selectedCourse = null;
        selectedCourseName = '';
        document.getElementById('stepSettings').style.display = 'none';
        document.getElementById('stepCourse').style.display = 'block';
        showLoading(false);
      }, 500);
    };

    /***********************
     * START EXAM - FETCH FROM SUPABASE
     ***********************/
    async function startExam() {
      if (!selectedCourse) return;

      // 1. Read settings
      const yearEl = document.getElementById('year');
      selectedYear = yearEl.value;
      durationSec = parseInt(document.getElementById('duration').value, 10) * 60;
      totalQuestions = parseInt(document.getElementById('qcount').value, 10);

      // 2. Show Spinner immediately
      showLoading(true);

      try {
        // 3. FETCH DATA FIRST (Do not switch screen yet)
        const { data: questionsData, error } = await supabaseClient
          .from('questions')
          .select('*')
          .eq('course_id', selectedCourse)
          .eq('year', selectedYear)
          .limit(totalQuestions);

        if (error) throw error;

        if (!questionsData || questionsData.length === 0) {
          throw new Error('No questions found for the selected course and year');
        }

        // 4. Process Data (Apply Math Fixes)
        questions = questionsData.map(item => {
          const rawQ = item.question_text || item.question || item.q || 'No question text';
          const rawOpts = item.options || item.opts || item.choices || [];
          
          let answer = item.answer;
          // Handle 'A','B' or '0','1' format
          if (typeof answer === 'string') {
            const map = {'A':0, 'B':1, 'C':2, 'D':3};
            answer = map[answer.toUpperCase()] !== undefined ? map[answer.toUpperCase()] : (parseInt(answer) || 0);
          } else {
            answer = answer || 0;
          }

          // --- ROBUST MATH FIX ---
          const fixedQ = fixMathText(rawQ);
          
          let parsedOpts = rawOpts;
          if (typeof parsedOpts === 'string') {
             try { parsedOpts = JSON.parse(parsedOpts); } catch(e) { parsedOpts = []; }
          }
          const fixedOpts = (parsedOpts || []).map(opt => fixMathText(opt));

          return {
            q: fixedQ,
            opts: fixedOpts,
            ans: parseInt(answer)
          };
        });

        // 5. Shuffle & Init State
        shuffle(questions);
        totalQuestions = questions.length;
        answers = Array(totalQuestions).fill(null);
        flags = Array(totalQuestions).fill(false);
        currentIndex = 0;

        // 6. SWITCH UI NOW (Data is ready, so no "Loading" text needed)
        document.getElementById('stepSettings').style.display = 'none';
        document.getElementById('stepExam').style.display = 'block';
        
        document.getElementById('courseLabel').textContent = selectedCourseName;
        document.getElementById('yearLabel').textContent = selectedYear;
        document.getElementById('totalCount').textContent = totalQuestions;

        // 7. Render
        buildQGrid();
        renderQuestion(); // Shows Q1 immediately
        startTimer();

      } catch (error) {
        console.error('Error loading questions:', error);
        
        // Handle Error UI
        document.getElementById('stepExam').style.display = 'none';
        document.getElementById('stepSettings').style.display = 'block';
        
        showModal('Notice', error.message || 'Error loading questions.', hideModal);
        
      } finally {
        // 8. Always hide the spinner at the end
        showLoading(false);
      }
    }

    // Make startExam globally available
    window.startExam = startExam;

    function shuffle(arr){
      for(let i=arr.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]]=[arr[j],arr[i]];
      }
      return arr;
    }

    /***********************
     * TIMER (auto submit)
     ***********************/
    function startTimer(){
      updateTimerLabel();
      timerId = setInterval(()=>{
        durationSec--;
        if(durationSec<=0){
          clearInterval(timerId);
          doSubmit(true);
        }
        updateTimerLabel();
      },1000);
    }
    function updateTimerLabel(){
      const m = Math.floor(Math.max(0,durationSec)/60).toString().padStart(2,'0');
      const s = (Math.max(0,durationSec)%60).toString().padStart(2,'0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }

    /***********************
     * RENDER + NAVIGATION
     ***********************/
    function buildQGrid(){
      const grid = document.getElementById('qGrid');
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
    function updateAnsweredCount(){
      const count = answers.filter(v=>v!=null).length;
      document.getElementById('answeredCount').textContent = count;
    }

    function renderQuestion(){
      const q = questions[currentIndex];
      const qText = document.getElementById('qText');
      const qOptions = document.getElementById('qOptions');
      
      let currentSmilesQueue = [];

      // Parse Q text
      const parsedQ = parseSmilesTags(`${currentIndex+1}. ${q.q}`);
      currentSmilesQueue.push(...parsedQ.smilesQueue);
      qText.innerHTML = parsedQ.htmlText;
      
      // Parse Options
      qOptions.innerHTML = q.opts.map((t,idx)=>{
        const checked = answers[currentIndex]===idx ? 'checked' : '';
        const parsedOpt = parseSmilesTags(t);
        currentSmilesQueue.push(...parsedOpt.smilesQueue);
        return `<label class="opt"><input type="radio" name="opt" value="${idx}" ${checked}> <span>${parsedOpt.htmlText}</span></label>`;
      }).join('');
      
      buildQGrid();
      
      qOptions.querySelectorAll('input[name="opt"]').forEach(inp=>{
        inp.addEventListener('change', e=>{
          answers[currentIndex] = parseInt(e.target.value,10);
          buildQGrid();
        });
      });

      // NEW: Draw molecules!
      drawMolecules(currentSmilesQueue);

      // TRIGGER MATHJAX
      if(window.MathJax) {
          MathJax.typesetPromise([qText, qOptions]).catch(err => console.log(err));
      }
    }

    function gotoQ(i){ currentIndex=i; renderQuestion(); }
    window.prevQ = function(){ if(currentIndex>0){ currentIndex--; renderQuestion(); } }
    window.nextQ = function(){ if(currentIndex<totalQuestions-1){ currentIndex++; renderQuestion(); } }

    window.toggleFlag = function(){
      flags[currentIndex] = !flags[currentIndex];
      buildQGrid();
    };

    /***********************
     * SUBMISSION + REVIEW
     ***********************/
    window.confirmSubmit = function(){
      showModal('Submit Exam','Are you sure you want to submit? You cannot change answers after submission.', ()=> doSubmit(false));
    };

    function doSubmit(auto=false){
      showLoading(true);
      if(timerId) clearInterval(timerId);
      
      // Calculate score
      let score=0;
      questions.forEach((q,i)=>{ if(answers[i]===q.ans) score++; });

      // Show results
      setTimeout(() => {
        document.getElementById('stepExam').style.display='none';
        document.getElementById('stepResult').style.display='block';
        document.getElementById('scoreLine').innerHTML =
          `${auto? '⏰ Time up — ':''}You scored <strong>${score}</strong> out of <strong>${totalQuestions}</strong>.`;

        hideModal();
        showLoading(false);
      }, 500);
    }

    window.showReview = function(){
      showLoading(true);
      setTimeout(() => {
        const list = document.getElementById('reviewList');
        
        let reviewSmilesQueue = []; // NEW: Track review molecules

        list.innerHTML = questions.map((q,i)=>{
          const userIdx = answers[i];
          const ok = userIdx===q.ans;
          
          const parsedQ = parseSmilesTags(`Q${i+1}: ${q.q}`);
          reviewSmilesQueue.push(...parsedQ.smilesQueue);

          let yourText = '<em>No answer</em>';
          if (userIdx != null) {
              const yourParsed = parseSmilesTags(q.opts[userIdx]);
              reviewSmilesQueue.push(...yourParsed.smilesQueue);
              yourText = yourParsed.htmlText;
          }

          const correctParsed = parseSmilesTags(q.opts[q.ans]);
          reviewSmilesQueue.push(...correctParsed.smilesQueue);
          const correctText = correctParsed.htmlText;

          return `<div class="card" style="background:rgba(255,255,255,0.05)">
            <div style="font-weight:700; margin-bottom:10px; font-size:16px; line-height:1.5">
               ${parsedQ.htmlText}
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div class="pill" style="width:fit-content; background:${ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}; border:1px solid ${ok?'#10b981':'#ef4444'}">
                ${ok?'Correct':'Wrong'}
              </div>
              <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">
                 <span style="color:#aaa; font-size:12px;">YOUR ANSWER:</span><br>
                 <strong>${yourText}</strong>
              </div>
              <div style="background:rgba(16,185,129,0.1); padding:8px; border-radius:6px; border:1px solid rgba(16,185,129,0.2)">
                 <span style="color:#10b981; font-size:12px;">CORRECT ANSWER:</span><br>
                 <strong>${correctText}</strong>
              </div>
            </div>
          </div>`;
        }).join('');

        document.getElementById('stepResult').style.display='none';
        document.getElementById('stepReview').style.display='block';
        
        // NEW: Draw molecules before MathJax
        drawMolecules(reviewSmilesQueue);

        // --- CRITICAL FIX: WAKE UP MATHJAX ---
        if(window.MathJax) {
            MathJax.typesetPromise([list]).then(() => {
                showLoading(false);
            });
        } else {
            showLoading(false);
        }

      }, 500);
    };
    
    window.backToResults = function(){
      showLoading(true);
      setTimeout(() => {
        document.getElementById('stepReview').style.display='none';
        document.getElementById('stepResult').style.display='block';
        showLoading(false);
      }, 500);
    };

    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
    }

    /***********************
     * CALCULATOR
     ***********************/
    const calc = document.getElementById('calc');
    window.toggleCalc = function(){ calc.style.display = (calc.style.display==='none'||!calc.style.display)?'block':'none'; }
    window.ins = function(ch){ document.getElementById('calcInput').value += ch; }
    window.clr = function(){ document.getElementById('calcInput').value=''; document.getElementById('calcOut').textContent='—'; }
    window.del1 = function(){
      const el = document.getElementById('calcInput');
      el.value = el.value.slice(0,-1);
    }
    window.evalCalc = function(){
      const raw = document.getElementById('calcInput').value.trim();
      if(!/^[0-9+\-*/().\s%^]+$/.test(raw)){ document.getElementById('calcOut').textContent='Invalid'; return; }
      const expr = raw.replace(/\^/g,'**');
      try{
        const val = Function('"use strict";return('+expr+')')();
        document.getElementById('calcOut').textContent = String(val);
      }catch(e){ document.getElementById('calcOut').textContent='Error'; }
    }

    /***********************
     * Modal (in-app popup)
     ***********************/
    function showModal(title,msg,onOk){
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalMsg').textContent = msg;
      const ok = document.getElementById('modalOk');
      ok.onclick = onOk || (()=>{});
      document.getElementById('overlay').style.display='flex';
    }
    function hideModal(){ document.getElementById('overlay').style.display='none'; }

    /***********************
     * LOADING FUNCTION
     ***********************/
    function showLoading(show) {
      document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    }

    /***********************
     * Client-side protections (deterrents)
     ***********************/
    document.addEventListener('contextmenu', e=> e.preventDefault());
    document.addEventListener('keydown', e=>{
      const c = e.ctrlKey || e.metaKey;
      if(c && ['c','x','s','p','u','a'].includes(e.key.toLowerCase())) e.preventDefault();
      if(e.key==='PrintScreen' || e.code==='PrintScreen'){ e.preventDefault(); showModal('Blocked','Screenshots are restricted in this demo.', hideModal); }
    });
    // prevent selection outside inputs
    document.addEventListener('selectstart', e=>{
      if(['INPUT','TEXTAREA'].includes((e.target.tagName||''))) return;
      e.preventDefault();
    });

  
  //Login Protection
  
    const logged = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
    if (!logged || !logged.email) {
      window.location.href = "index.html";
    }