const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let selectedCourseId = null;
    let selectedCourseCode = '';
    let selectedType = '';

    document.addEventListener('DOMContentLoaded', () => {
      const user = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
      if (!user) { window.location.href = 'index.html'; return; }

      const grid = document.getElementById('watermarkGrid');
      const email = user.email || 'User';
      for(let i=0; i<30; i++) {
        const div = document.createElement('div');
        div.className = 'watermark-item';
        div.textContent = email;
        grid.appendChild(div);
      }

      loadCourses();

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          document.body.classList.add("blur-content");
        } else {
          document.body.classList.remove("blur-content");
        }
      });
    });

    async function loadCourses() {
      showLoading(true);
      try {
        const { data: courses, error } = await supabaseClient
          .from('courses')
          .select('*')
          .order('code');

        if(error) throw error;

        const list = document.getElementById('courseList');
        list.innerHTML = '';

        const groups = {};
        courses.forEach(c => {
          if(!groups[c.code]) groups[c.code] = [];
          groups[c.code].push(c);
        });

        Object.keys(groups).forEach(code => {
          const variants = groups[code];
          const div = document.createElement('div');
          div.className = 'course-card';
          
          let btns = '';
          variants.forEach(v => {
            const color = v.type === 'exam' ? '#4CAF50' : '#2196F3';
            btns += `<button class="action-btn" style="background:${color}; color:white;" onclick="openYearSelect('${v.id}', '${v.code}', '${v.type}')">${v.type.toUpperCase()}</button>`;
          });

          div.innerHTML = `
            <div style="font-size:20px; font-weight:800; margin-bottom:10px;">${code}</div>
            <div style="display:flex; flex-wrap:wrap; justify-content:center;">${btns}</div>
          `;
          list.appendChild(div);
        });

      } catch(e) {
        console.error(e);
        alert('Error loading courses');
      } finally {
        showLoading(false);
      }
    }

    async function openYearSelect(id, code, type) {
      selectedCourseId = id;
      selectedCourseCode = code;
      selectedType = type;
      showLoading(true);

      try {
        const { data: years } = await supabaseClient
          .from('questions')
          .select('year')
          .eq('course_id', id);

        const uniqueYears = [...new Set(years.map(y => y.year))].sort((a,b) => b-a);
        
        const grid = document.getElementById('yearGrid');
        grid.innerHTML = '';
        document.getElementById('modalCourseTitle').textContent = `${code} (${type}) Years`;

        uniqueYears.forEach(year => {
          const d = document.createElement('div');
          d.className = 'year-card';
          d.textContent = year;
          d.onclick = () => loadQuestions(year);
          grid.appendChild(d);
        });

        document.getElementById('yearModal').style.display = 'flex';
      } catch(e) {
        console.error(e);
      } finally {
        showLoading(false);
      }
    }

    function closeYearModal() {
      document.getElementById('yearModal').style.display = 'none';
    }

    function fixMathText(text) {
      if (!text) return "";
      let fixed = text;
      const mathWords = ["frac", "sqrt", "int", "lim", "sum", "prod", "infty", "times", "div", "pm", "cdot", "partial", "sin", "cos", "tan", "csc", "sec", "cot", "log", "ln", "exp", "det", "cup", "cap", "notin", "subset", "subseteq", "forall", "exists", "empty", "union", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow", "implies", "theta", "pi", "alpha", "beta", "gamma", "delta", "lambda", "mu", "sigma", "omega", "Delta", "Sigma", "Omega", "phi", "psi", "rho", "epsilon"];

      mathWords.forEach(word => {
          const regex = new RegExp(`(?<!\\\\)\\b${word}\\b`, 'g');
          fixed = fixed.replace(regex, `\\${word}`);
      });

      fixed = fixed.replace(/\\\\/g, "\\");
      const isMathSymbol = /[\\][a-zA-Z]+/.test(fixed) || /[=^_{}<>]/.test(fixed);
      const hasDelimiters = fixed.includes("$") || fixed.includes("\\(") || fixed.includes("\\[");
      const isLongText = fixed.length > 50 && !fixed.includes("="); 

      if (isMathSymbol && !hasDelimiters && !isLongText) {
          return `\\( ${fixed} \\)`;
      }
      return fixed;
    }

    async function loadQuestions(year) {
      closeYearModal();
      showLoading(true);

      try {
        const { data: qs, error } = await supabaseClient
          .from('questions')
          .select('*')
          .eq('course_id', selectedCourseId)
          .eq('year', year)
          .order('id');

        if(error) throw error;

        const container = document.getElementById('questionsList');
        container.innerHTML = '';
        document.getElementById('questionsTitle').textContent = `${selectedCourseCode} ${selectedType.toUpperCase()} - ${year}`;

        qs.forEach((q, idx) => {
          const ansIdx = parseInt(q.answer);
          let opts = q.options;
          if (typeof opts === 'string') {
              try { opts = JSON.parse(opts); } catch(e) { opts = []; }
          }
          if (!opts) opts = [];

          const fixedQuestionText = fixMathText(q.question_text);
          const fixedDetails = fixMathText(q.Details || q.details || "No explanation provided.");

          let optHtml = '';
          opts.forEach((opt, i) => {
            const isCorrect = i === ansIdx;
            const fixedOption = fixMathText(opt);
            optHtml += `
              <div class="option-item ${isCorrect ? 'correct' : ''}">
                ${isCorrect ? '<span class="checkmark">✔</span>' : '<span class="circle-mark">○</span>'}
                ${String.fromCharCode(65+i)}. ${fixedOption}
              </div>
            `;
          });

          const div = document.createElement('div');
          div.className = 'question-item';
          div.innerHTML = `
            <div class="question-text">Q${idx+1}. ${fixedQuestionText}</div>
            <div>${optHtml}</div>
            <button class="reveal-btn" onclick="toggleSolution('sol-${idx}')">💡 Reveal Solution</button>
            <div id="sol-${idx}" class="solution-box">
              <strong>Solving / Explanation:</strong>
              ${fixedDetails}
            </div>
          `;
          container.appendChild(div);
        });

        document.getElementById('courseList').style.display = 'none';
        document.getElementById('questionsContainer').style.display = 'block';

        if (window.MathJax) {
            MathJax.typesetPromise();
        }

      } catch(e) {
        console.error(e);
        alert('Error loading questions');
      } finally {
        showLoading(false);
      }
    }

    window.toggleSolution = function(id) {
      const box = document.getElementById(id);
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
    };

    function goBackToCourses() {
      document.getElementById('questionsContainer').style.display = 'none';
      document.getElementById('courseList').style.display = 'grid';
    }

    function showLoading(b) {
      document.getElementById('globalLoading').style.display = b ? 'flex' : 'none';
    }

    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', function(e) {
      if((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        e.preventDefault();
      }
    });