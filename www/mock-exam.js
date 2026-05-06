/***********************
     * SUPABASE CONFIGURATION - FIXED
     ***********************/
    let supabaseClient;
    
    // Initialize Supabase safely - FIXED
    (function initSupabase() {
      const supabaseUrl = 'https://xtmoolyxxylylttugjek.supabase.co';
      const supabaseKey = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
      
      // Always create a fresh client for this page
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialized:', !!supabaseClient);
    })();

    /***********************
     * APPLICATION STATE
     ***********************/
    let mockExamState = {
      year: null,
      semester: null,
      semester_id: null,
      semester_name: null,
      type: null,
      courses: [],
      currentStep: 0,
      userProgress: {},
      semesterSettings: {},
      examSettings: {}, // NEW: Store exam settings
      // NEW: Track current session
      session_id: null,
      started_at: null,
      // Track progress for THIS SESSION only
      session_progress: {}
    };

    let currentAssessment = {
      courseId: null,
      courseCode: null,
      courseName: '',
      assessmentType: 'test',
      durationSec: 0,
      totalQuestions: 0,
      timerId: null,
      currentIndex: 0,
      questions: [],
      answers: [],
      flags: [],
      semesterId: null,
      session_id: null,
      testPassMark: 20, // Default
      examPassMark: 30  // Default
    };

    let currentAuthId = null;
    let currentUserEmail = null;
    let autoRedirectTimer = null;

    /***********************
     * INITIALIZATION
     ***********************/
    document.addEventListener('DOMContentLoaded', async function() {
      try {
        // Show pre-instructions loading animation
        document.getElementById('preInstructionsLoading').style.display = 'flex';
        
        console.log('Supabase client created successfully');
        
        // STRICT LOGIN CHECK
        const user = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
        if (!user || !user.email) {
          window.location.href = "index.html";
          return;
        }
        
        currentUserEmail = user.email;
        document.getElementById('wmText').textContent = currentUserEmail;
        document.getElementById('userTag').textContent = currentUserEmail;
        if(document.getElementById('mobileUserEmail')) {
            document.getElementById('mobileUserEmail').textContent = currentUserEmail;
        }

        // Get current authenticated user from Supabase
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
        if (authError) {
          console.error('Auth error:', authError);
          await handleReauthentication();
        } else if (authUser) {
          currentAuthId = authUser.id;
          console.log('Current auth ID:', currentAuthId);
        } else {
          window.location.href = "index.html";
          return;
        }

        // Check for refresh parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('refresh') || urlParams.has('submitted')) {
          document.getElementById('refreshNotice').style.display = 'flex';
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }

        // Check for active session
        await checkAndRestoreSession();
        
        // Hide pre-instructions loading after 1.5 seconds
        setTimeout(() => {
          document.getElementById('preInstructionsLoading').style.display = 'none';
        }, 1500);
        
      } catch (error) {
        console.error('Error during initialization:', error);
        showModal('Error', 'Failed to initialize. Please refresh the page.', function() {
          hideModal();
          location.reload();
        });
      }
    });

    /***********************
     * SESSION MANAGEMENT
     ***********************/
    async function checkAndRestoreSession() {
      try {
        // Check if we have an active session
        const sessionData = localStorage.getItem('mockExamActiveSession');
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          
          // Check if session is recent (within 24 hours) and belongs to current user
          const sessionAge = Date.now() - new Date(session.started_at).getTime();
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge < maxSessionAge && session.auth_id === currentAuthId) {
            // Restore session
            mockExamState = { 
              ...mockExamState, 
              year: session.year,
              semester: session.semester,
              semester_id: session.semester_id,
              semester_name: session.semester_name,
              type: session.type,
              courses: session.courses || [],
              session_id: session.session_id,
              started_at: session.started_at,
              session_progress: {},
              examSettings: session.examSettings || {}
            };
            
            // Show progress dashboard
            showStep('stepProgress');
            showStartNewButton(true);
            await updateProgressDashboard();
            return;
          } else {
            // Session expired, clear it
            clearSessionStorage();
          }
        }
        
        // No valid session, start from instructions
        showStep('stepInstructions');
        showStartNewButton(false);
        
      } catch (error) {
        console.error('Error restoring session:', error);
        
        // Clear corrupted session data
        clearSessionStorage();
        
        // Start fresh
        showStep('stepInstructions');
        showStartNewButton(false);
      }
    }
    
    function clearSessionStorage() {
      localStorage.removeItem('mockExamActiveSession');
      console.log('Session storage cleared');
    }
    
    function saveSessionToStorage() {
      try {
        const sessionData = {
          year: mockExamState.year,
          semester: mockExamState.semester,
          semester_id: mockExamState.semester_id,
          semester_name: mockExamState.semester_name,
          type: mockExamState.type,
          courses: mockExamState.courses || [], // **FIX: Make sure courses are saved**
          session_id: mockExamState.session_id,
          started_at: mockExamState.started_at,
          session_progress: mockExamState.session_progress || {}, // **FIX: Save session progress**
          auth_id: currentAuthId,
          last_updated: new Date().toISOString()
        };
        
        localStorage.setItem('mockExamActiveSession', JSON.stringify(sessionData));
        console.log('Session saved to localStorage with', sessionData.courses.length, 'courses');
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    /***********************
     * STEP 0: INSTRUCTIONS
     ***********************/
    window.proceedToYearSelection = function() {
      showLoading(true);
      setTimeout(() => {
        showStep('step1');
        initStep1();
        showLoading(false);
      }, 500);
    };

    /***********************
     * STEP 1: YEAR SELECTION (FIXED)
     ***********************/
    async function initStep1() {
      const yearGrid = document.getElementById('yearGrid');
      const loadingEl = document.getElementById('loadingYears');
      const errorEl = document.getElementById('networkErrorYears');
      
      yearGrid.innerHTML = '';
      loadingEl.style.display = 'flex';
      errorEl.style.display = 'none';

      try {
        if (!navigator.onLine) throw new Error('No internet connection');

        // Calls the database function we created to get distinct years directly
        const { data: uniqueYears, error } = await supabaseClient
          .rpc('get_unique_years');

        if (error) throw error;

        loadingEl.style.display = 'none';
        
        // Ensure years are unique (though RPC handles this) and flatten structure if needed
        const yearsList = (uniqueYears || []).map(item => item.year || item); 

        if (yearsList.length === 0) {
          yearGrid.innerHTML = '<div>No years available.</div>';
          return;
        }
        
        yearsList.forEach(year => {
          const card = document.createElement('div');
          card.className = 'course';
          card.setAttribute('data-year', year);
          card.innerHTML = `
            <div style="font-weight:800; font-size:18px">${year}</div>
            <div style="font-size:14px; margin-top:8px; color:var(--muted)">
              ${year == new Date().getFullYear() ? 'Current Year' : 'Past Year'}
            </div>
          `;
          
          card.addEventListener('click', function() {
            document.querySelectorAll('#step1 .course').forEach(c => {
              c.style.background = 'var(--panel)';
              c.style.borderColor = 'rgba(255,255,255,0.12)';
            });
            this.style.background = 'rgba(63, 102, 255, 0.3)';
            this.style.borderColor = 'var(--accent)';
            mockExamState.year = year;
            document.getElementById('btnStep1').disabled = false;
          });
          yearGrid.appendChild(card);
        });
        
      } catch (error) {
        console.error('Error loading years:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        yearGrid.innerHTML = '<div>Error loading years</div>';
      }
    }

    /***********************
     * STEP 2: SEMESTER SELECTION
     ***********************/
    async function initStep2() {
      const semesterGrid = document.getElementById('semesterGrid');
      const loadingEl = document.getElementById('loadingSemesters');
      
      semesterGrid.innerHTML = '';
      loadingEl.style.display = 'flex';

      try {
        if (!navigator.onLine) throw new Error('No internet connection');

        // Fetch semesters from Supabase
        const { data: semesters, error } = await supabaseClient
          .from('semesters')
          .select('*')
          .order('academic_year', { ascending: false });

        if (error) throw error;

        loadingEl.style.display = 'none';
        
        if (!semesters || semesters.length === 0) {
          semesterGrid.innerHTML = '<div>No semesters found. Please contact admin.</div>';
          return;
        }

        semesters.forEach(semester => {
          const card = document.createElement('div');
          card.className = 'course';
          card.setAttribute('data-semester-id', semester.id);
          card.setAttribute('data-semester-name', semester.semester_name);
          card.innerHTML = `
            <div style="font-weight:800; font-size:18px">${semester.semester_name}</div>
            <div style="font-size:14px; margin-top:8px; color:var(--muted)">
              ${semester.academic_year} • ${semester.semester_type === 'first' ? 'First Semester' : 'Second Semester'}
            </div>
          `;
          
          card.addEventListener('click', async function() {
            document.querySelectorAll('#step2 .course').forEach(c => {
              c.style.background = 'var(--panel)';
              c.style.borderColor = 'rgba(255,255,255,0.12)';
            });
            this.style.background = 'rgba(63, 102, 255, 0.3)';
            this.style.borderColor = 'var(--accent)';
            
            mockExamState.semester_id = this.getAttribute('data-semester-id');
            mockExamState.semester_name = this.getAttribute('data-semester-name');
            mockExamState.semester = semester.semester_type === 'first' ? '1' : '2';
            
            // Load exam settings
            await loadExamSettings();
            
            document.getElementById('btnStep2').disabled = false;
          });
          semesterGrid.appendChild(card);
        });
        
      } catch (error) {
        console.error('Error loading semesters:', error);
        loadingEl.style.display = 'none';
        semesterGrid.innerHTML = '<div>Error loading semesters</div>';
      }
    }

    /***********************
     * LOAD EXAM SETTINGS FROM exam_settings TABLE
     ***********************/
    async function loadExamSettings() {
      try {
        console.log('Loading exam settings...');
        
        // Load from exam_settings table
        const { data: examSettingsData, error } = await supabaseClient
          .from('semester_courses')
          .select('*');

        if (error) throw error;

        if (examSettingsData && examSettingsData.length > 0) {
          // Store exam settings by course code
          mockExamState.examSettings = {};
          examSettingsData.forEach(setting => {
            mockExamState.examSettings[setting.course_code] = {
              test_question_limit: setting.test_question_limit || 25,
              exam_question_limit: setting.exam_question_limit || 30,
              test_time_limit: setting.test_time_limit || 2700, // 45 minutes in seconds
              exam_time_limit: setting.exam_time_limit || 3600, // 60 minutes in seconds
              test_pass_mark: setting.test_pass_mark || 20, // 50% of 40
              exam_pass_mark: setting.exam_pass_mark || 30  // 50% of 60
            };
          });
        }
        
        console.log('Exam settings loaded:', mockExamState.examSettings);
      } catch (error) {
        console.error('Error loading exam settings:', error);
        // Set default values if there's an error
        mockExamState.examSettings = {
          default: {
            test_question_limit: 25,
            exam_question_limit: 30,
            test_time_limit: 2700,
            exam_time_limit: 3600,
            test_pass_mark: 20,
            exam_pass_mark: 30
          }
        };
      }
    }

    /***********************
     * STEP 3: TEST/EXAM SELECTION
     ***********************/
    function initStep3() {
      document.querySelectorAll('#step3 .course').forEach(card => {
        card.addEventListener('click', function() {
          const type = this.getAttribute('data-type');
          
          if (type === 'exam') {
            // Hide both options first
            document.querySelectorAll('#step3 .course').forEach(c => {
              c.style.background = 'var(--panel)';
              c.style.borderColor = 'rgba(255,255,255,0.12)';
            });
            
            // Show warning
            document.getElementById('examWarning').style.display = 'block';
            document.getElementById('btnStep3').disabled = true;
            return;
          }
          
          // For tests, always allow
          document.getElementById('examWarning').style.display = 'none';
          document.querySelectorAll('#step3 .course').forEach(c => {
            c.style.background = 'var(--panel)';
            c.style.borderColor = 'rgba(255,255,255,0.12)';
          });
          
          this.style.background = 'rgba(63, 102, 255, 0.3)';
          this.style.borderColor = 'var(--accent)';
          mockExamState.type = type;
          document.getElementById('btnStep3').disabled = false;
        });
      });
    }

    /***********************
     * STEP 4: COURSE SELECTION
     ***********************/
    async function initStep4() {
      const coursesList = document.getElementById('coursesList');
      const loadingEl = document.getElementById('loadingCourses');
      const errorEl = document.getElementById('networkErrorCourses');
      
      coursesList.innerHTML = '';
      loadingEl.style.display = 'flex';
      errorEl.style.display = 'none';

      try {
        if (!navigator.onLine) throw new Error('No internet connection');

        // Get the correct course IDs based on semester
        const firstSemesterIds = [1,2,3,4,5,6,7,8,9,10,11,12,15,16,19,20,21,22,23,24,25,26,27,28,33,34,37,38,39,40,41,42,43,44,49,50,53,54,55,56,59,60,61,62,65,66,67,68,69,70,73,74,75,76,77,78,79,80];
        const secondSemesterIds = [13,14,17,18,29,30,31,32,35,36,45,46,47,48,51,52,57,58,63,64,71,72];
        const targetIds = mockExamState.semester == 1 ? firstSemesterIds : secondSemesterIds;

        // Fetch ALL courses for this semester (both test and exam)
        const { data: courses, error } = await supabaseClient
          .from('courses')
          .select('*')
          .in('id', targetIds)
          .order('code');

        if (error) throw error;

        loadingEl.style.display = 'none';
        if (courses.length === 0) {
          coursesList.innerHTML = '<div>No courses found.</div>';
          return;
        }

        // Group courses by code and type
        const courseGroups = {};
        courses.forEach(course => {
          if (!courseGroups[course.code]) courseGroups[course.code] = {};
          
          if (course.type === 'test') {
            courseGroups[course.code].test = course;
          } else if (course.type === 'exam') {
            courseGroups[course.code].exam = course;
          }
        });

        // Display courses based on assessment type
        Object.keys(courseGroups).forEach(courseCode => {
          const courseGroup = courseGroups[courseCode];
          const examCourse = courseGroup.exam;
          const testCourse = courseGroup.test;
          
          // Only show courses that match the assessment type
          const shouldShow = (mockExamState.type === 'test' && testCourse) || 
                             (mockExamState.type === 'exam' && examCourse);
          
          if (shouldShow) {
            const targetCourse = mockExamState.type === 'test' ? testCourse : examCourse;
            const courseItem = document.createElement('div');
            courseItem.className = 'course-item';
            const credits = targetCourse.credits || 3;
            
            // Get settings from exam_settings
            const settings = mockExamState.examSettings[courseCode] || mockExamState.examSettings.default || {};
            const testLimit = settings.test_question_limit || 25;
            const examLimit = settings.exam_question_limit || 30;
            const testTime = settings.test_time_limit || 2700;
            const examTime = settings.exam_time_limit || 3600;
            const testPass = settings.test_pass_mark || 20;
            const examPass = settings.exam_pass_mark || 30;
            
            courseItem.innerHTML = `
              <input type="checkbox" class="course-checkbox" 
                     data-course-code="${courseCode}"
                     data-course-id="${targetCourse.id}"
                     data-course-credits="${credits}"
                     data-course-type="${mockExamState.type}">
              <div style="flex:1">
                <div style="font-weight:700">${courseCode}</div>
                <div style="font-size:12px; color:var(--muted)">
                  ${mockExamState.type === 'test' ? '📚 Test' : '📝 Exam'} • ${credits} Credit${credits > 1 ? 's' : ''} • ID: ${targetCourse.id}
                </div>
                <div style="font-size:11px; color:var(--accent); margin-top:4px;">
                  ${mockExamState.type === 'test' 
                    ? `${testLimit} questions (${Math.floor(testTime/60)} min, Pass: ${testPass}/40)`
                    : `${examLimit} questions (${Math.floor(examTime/60)} min, Pass: ${examPass}/60)`}
                </div>
              </div>
            `;
            
            coursesList.appendChild(courseItem);
          }
        });

        // Initialize checkboxes
        document.querySelectorAll('.course-checkbox').forEach(checkbox => {
          checkbox.addEventListener('change', function() {
            const courseCode = this.getAttribute('data-course-code');
            const courseId = this.getAttribute('data-course-id');
            const credits = parseInt(this.getAttribute('data-course-credits'));
            const courseType = this.getAttribute('data-course-type');
            
            if (this.checked) {
              // Add course with correct ID
              mockExamState.courses.push({ 
                id: courseId, 
                name: `${courseCode} - ${courseType === 'exam' ? 'Exam' : 'Test'}`,
                type: courseType,
                credits: credits,
                code: courseCode
              });
            } else {
              // Remove course by ID
              mockExamState.courses = mockExamState.courses.filter(c => 
                c.id !== courseId
              );
            }
            
            document.getElementById('selectedCount').textContent = 
              mockExamState.courses.filter(c => c.type === mockExamState.type).length;
            document.getElementById('btnStep4').disabled = mockExamState.courses.length === 0;
          });
        });
        
      } catch (error) {
        console.error('Error loading courses:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        coursesList.innerHTML = '<div>Error loading courses</div>';
      }
    }

    /***********************
     * SAVE COURSE SELECTION
     ***********************/
    window.saveCourseSelection = function() {
      // Filter courses to only include selected type
      mockExamState.courses = mockExamState.courses.filter(course => 
        course.type === mockExamState.type
      );

      // **GENERATE ONE MAIN SESSION ID FOR EVERYTHING**
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      mockExamState.session_id = `mock_${mockExamState.type}_${timestamp}_${randomStr}`;
      
      mockExamState.started_at = new Date().toISOString();
      mockExamState.session_progress = {};
      
      console.log('✅ GENERATED MAIN SESSION ID:', mockExamState.session_id);
      console.log('This ID will be used for ALL tests and exams in this session');

      // Initialize progress
      mockExamState.courses.forEach(course => {
        const courseCode = course.code;
        mockExamState.session_progress[courseCode] = {
          completed: false,
          score: null,
          started: false,
          assessment_type: mockExamState.type,
          main_session_id: mockExamState.session_id // Track it
        };
      });

      saveSessionToStorage();
      
      showLoading(true);
      setTimeout(() => {
        showStep('stepProgress');
        updateProgressDashboard();
        showStartNewButton(true);
        showLoading(false);
      }, 500);
    };

    /***********************
     * PROGRESS DASHBOARD
     ***********************/
   async function updateProgressDashboard() {
      const dashboard = document.getElementById('progressDashboard');
      const subtitle = document.getElementById('progressSubtitle');
      const refreshNotice = document.getElementById('refreshNotice');
      
      subtitle.textContent = `${mockExamState.semester_name} - ${mockExamState.type === 'test' ? 'Tests' : 'Exams'}`;
      dashboard.innerHTML = '';
      
      // Hide refresh notice initially
      refreshNotice.style.display = 'none';
      
      let allCompleted = true;
      let allTestsCompleted = true;
      
      // Filter courses by current type
      const filteredCourses = mockExamState.courses.filter(course => 
        course.type === mockExamState.type
      );
      
      console.log('Filtered courses for dashboard:', filteredCourses);
      console.log('Current session ID:', mockExamState.session_id);
      
      for (const course of filteredCourses) {
        const courseCode = course.code;
        
        console.log('Checking progress for course:', courseCode, 'ID:', course.id);
        
        // Initialize session progress if not exists
        if (!mockExamState.session_progress[courseCode]) {
          mockExamState.session_progress[courseCode] = {
            completed: false,
            score: null,
            started: false,
            passed: false,
            assessment_type: mockExamState.type,
            session_id: mockExamState.session_id,
            course_id: course.id // Store course ID
          };
        }
        
        let sessionProgress = mockExamState.session_progress[courseCode];
        let hasCompletedAssessment = sessionProgress.completed;
        let score = sessionProgress.score;
        let passed = sessionProgress.passed;
        
        // If not completed in current session, check Supabase for assessments
        if (!hasCompletedAssessment) {
          try {
            const tableName = mockExamState.type === 'test' ? 'user_test_progress' : 'user_exam_progress';
            
            const { data: assessment, error } = await supabaseClient
              .from(tableName)
              .select('score, completed, passed, session_id, submitted_at')
              .eq('auth_id', currentAuthId)
              .eq('course_code', courseCode)
              .eq('semester_id', mockExamState.semester_id)
              .eq('session_id', mockExamState.session_id)
              .eq('completed', true)
              .single();

            if (!error && assessment) {
              console.log('Found assessment for', courseCode, 'in current session:', assessment);
              
              hasCompletedAssessment = true;
              score = assessment.score || null;
              passed = assessment.passed || false;
              
              // Update session progress
              sessionProgress = {
                completed: true,
                score: score,
                passed: passed,
                started: true,
                assessment_type: mockExamState.type,
                session_id: assessment.session_id,
                course_id: course.id
              };
              
              mockExamState.session_progress[courseCode] = sessionProgress;
              console.log('Updated session progress for', courseCode);
            } else if (error && error.code !== 'PGRST116') {
              console.error('Error fetching assessment for', courseCode, error);
            } else {
              console.log('No assessment found for', courseCode, 'in current session');
            }
          } catch (error) {
            console.error('Error checking assessment for', courseCode, error);
          }
        }
        
        const isCompleted = hasCompletedAssessment;
        
        if (mockExamState.type === 'test' && !isCompleted) {
          allTestsCompleted = false;
        }
        if (!isCompleted) allCompleted = false;

        const card = document.createElement('div');
        card.className = 'course-progress-card';
        
        let status, action;
        if (isCompleted) {
          status = 'Completed';
          action = 'Completed';
        } else if (sessionProgress.started) {
          status = 'In Progress';
          action = 'Continue';
        } else {
          status = 'Not Started';
          action = 'Start';
        }
        
        // Get pass mark for this course
        const settings = mockExamState.examSettings[courseCode] || mockExamState.examSettings.default || {};
        const passMark = mockExamState.type === 'test' ? settings.test_pass_mark || 20 : settings.exam_pass_mark || 30;
        const maxScore = mockExamState.type === 'test' ? 40 : 60;
        const isPassed = score >= passMark;
        
        // FIX: Use proper string escaping for onclick
        const startAssessmentCall = `startAssessment('${course.id}', '${course.name.replace(/'/g, "\\'")}', '${course.code}', '${course.type}')`;
        const retakeAssessmentCall = `retakeInNewSession('${course.id}', '${course.name.replace(/'/g, "\\'")}', '${course.code}', '${course.type}')`;
        
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 700; font-size: 16px;">${course.name}</div>
            <div style="font-size: 12px; color: var(--muted);">${course.credits} Credit${course.credits > 1 ? 's' : ''}</div>
          </div>
          <div class="progress-row">
            <div style="font-size: 14px;">Status</div>
            <span class="status-badge status-${status.toLowerCase().replace(' ', '-')}">${status}</span>
            <div style="font-size: 14px; min-width: 40px; text-align: right;">
              ${isCompleted ? `${score || 0}/${maxScore}` : ''}
            </div>
          </div>
          ${isCompleted ? `
            <div class="progress-row">
              <div style="font-size: 14px;">Result</div>
              <span class="status-badge ${isPassed ? 'status-completed' : 'status-not-started'}">
                ${isPassed ? 'PASSED' : 'FAILED'} (Pass: ${passMark})
              </span>
            </div>
          ` : ''}
          <div class="actions" style="margin-top: 12px;">
            <button class="btn" onclick="${startAssessmentCall}" 
                    ${isCompleted ? 'disabled' : ''}>
              ${action} ${mockExamState.type === 'test' ? 'Test' : 'Exam'}
            </button>
            ${isCompleted ? `
              <button class="btn secondary" onclick="${retakeAssessmentCall}" style="margin-left: 10px;">
                Start New
              </button>
            ` : ''}
          </div>
        `;
        dashboard.appendChild(card);
      }

      console.log('Dashboard status:', {
        allTestsCompleted,
        allCompleted,
        type: mockExamState.type,
        filteredCoursesCount: filteredCourses.length,
        currentSessionId: mockExamState.session_id
      });

      // Show "Take Exams" button if all tests are completed
      const takeExamsBtn = document.getElementById('btnTakeExams');
      const shouldShowTakeExams = (mockExamState.type === 'test' && allTestsCompleted && filteredCourses.length > 0);
      
      takeExamsBtn.style.display = shouldShowTakeExams ? 'block' : 'none';
      takeExamsBtn.disabled = !shouldShowTakeExams;
      
      // Show final results button if all exams are completed
      const finalResultsBtn = document.getElementById('btnFinalResults');
      const shouldShowFinalResults = (mockExamState.type === 'exam' && allCompleted && filteredCourses.length > 0);
      
      finalResultsBtn.style.display = shouldShowFinalResults ? 'block' : 'none';
      finalResultsBtn.disabled = !shouldShowFinalResults;
      
      // Save basic session
      saveSessionToStorage();
      
      // Show refresh notice if we just submitted an assessment
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('submitted')) {
        refreshNotice.style.display = 'flex';
      }
    }
    
    /***********************
     * RELOAD PROGRESS DASHBOARD
     ***********************/
    window.reloadProgressDashboard = function() {
      showLoading(true);
      setTimeout(() => {
        updateProgressDashboard();
        showLoading(false);
        // Hide the refresh notice
        document.getElementById('refreshNotice').style.display = 'none';
      }, 500);
    };

    // Fix the "retakeAssessment is not defined" error
    window.retakeAssessment = function(courseId, courseName, courseCode, courseType) {
      // This is now an alias for retakeInNewSession
      retakeInNewSession(courseId, courseName, courseCode, courseType);
    };

    function clearAllSessionData() {
      try {
        // Clear in-memory state
        mockExamState = { 
          year: null, 
          semester: null, 
          semester_id: null, 
          semester_name: null, 
          type: null, 
          courses: [], 
          currentStep: 0, 
          userProgress: {}, 
          semesterSettings: {},
          examSettings: {},
          session_id: null,
          started_at: null,
          session_progress: {}
        };
        
        currentAssessment = {
          courseId: null,
          courseCode: null,
          courseName: '',
          assessmentType: 'test',
          durationSec: 0,
          totalQuestions: 0,
          timerId: null,
          currentIndex: 0,
          questions: [],
          answers: [],
          flags: [],
          semesterId: null,
          session_id: null,
          testPassMark: 20,
          examPassMark: 30
        };
        
        // Clear localStorage
        localStorage.removeItem('mockExamActiveSession');
        
        // Safely clear URL parameters without modifying history
        try {
          const currentUrl = new URL(window.location.href);
          if (currentUrl.search) {
            // Only try to clean if there are search params
            currentUrl.search = '';
            window.history.replaceState({}, document.title, currentUrl.toString());
          }
        } catch (historyError) {
          console.warn('Could not clean URL, continuing anyway:', historyError);
          // This is not critical, continue execution
        }
        
        console.log('All session data cleared completely');
      } catch (error) {
        console.error('Error clearing session data:', error);
        // Still clear the important data even if URL cleaning fails
        localStorage.removeItem('mockExamActiveSession');
        throw error; // Re-throw to be handled by caller
      }
    }

    /***********************
     * RETAKE ASSESSMENT
     ***********************/
    // Replace the old retakeAssessment function with this
    window.retakeInNewSession = function(courseId, courseName, courseCode, courseType) {
      showModal('Start New Assessment', 
        'This will start a completely fresh assessment in a new session.<br><br>' +
        'Your previous score will remain saved, but this will allow you<br>' +
        'to take the assessment again with new questions.',
      function() {
        // Reset progress for this course in current session
        if (mockExamState.session_progress[courseCode]) {
          mockExamState.session_progress[courseCode] = {
            completed: false,
            score: null,
            started: false,
            passed: false,
            assessment_type: mockExamState.type,
            assessment_session_id: null
          };
        }
        
        // Update localStorage
        saveSessionToStorage();
        
        // Update dashboard
        updateProgressDashboard();
        hideModal();
      });
    };

    /***********************
     * START ASSESSMENT
     ***********************/
    window.startAssessment = async function(courseId, courseName, courseCode, courseType) {
      try {
        showLoading(true);
        
        // Use the stored course ID directly
        currentAssessment.courseId = courseId;
        currentAssessment.courseCode = courseCode;
        currentAssessment.courseName = courseName;
        currentAssessment.assessmentType = mockExamState.type;
        currentAssessment.semesterId = mockExamState.semester_id;
        
        console.log('Starting assessment with:', {
          courseId: courseId,
          courseCode: courseCode,
          assessmentType: mockExamState.type
        });

        // Generate a UNIQUE session ID for THIS specific assessment
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9);
        const typePrefix = mockExamState.type === 'test' ? 'test' : 'exam';
        currentAssessment.session_id = `${typePrefix}_${courseCode}_${timestamp}_${randomStr}`;
        
        console.log('Generated assessment session ID:', currentAssessment.session_id);

        // Get settings from exam_settings
        const settings = mockExamState.examSettings[courseCode] || mockExamState.examSettings.default || {};
        
        if (mockExamState.type === 'test') {
          currentAssessment.durationSec = settings.test_time_limit || 2700;
          currentAssessment.totalQuestions = settings.test_question_limit || 25;
          currentAssessment.testPassMark = settings.test_pass_mark || 20;
        } else {
          currentAssessment.durationSec = settings.exam_time_limit || 3600;
          currentAssessment.totalQuestions = settings.exam_question_limit || 30;
          currentAssessment.examPassMark = settings.exam_pass_mark || 30;
        }

        currentAssessment.remainingTime = currentAssessment.durationSec;
        
        setTimeout(() => {
          showStep('stepExam');
          loadQuestions();
          showLoading(false);
        }, 500);
        
      } catch (error) {
        console.error('Error starting assessment:', error);
        showLoading(false);
        showModal('Error', `Failed to start assessment: ${error.message}`, function() {
          hideModal();
          showStep('stepProgress');
        });
      }
    };

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
     * LOAD QUESTIONS
     ***********************/
    async function loadQuestions() {
      try {
        showLoading(true);
        
        document.getElementById('courseLabel').textContent = currentAssessment.courseName;
        document.getElementById('assessmentTypeLabel').textContent = 
          currentAssessment.assessmentType === 'test' ? 'Test' : 'Exam';
        document.getElementById('qText').innerHTML = 'Loading questions…'; // Changed to innerHTML
        document.getElementById('qOptions').innerHTML = '';

        if (!navigator.onLine) throw new Error('No internet connection');

        let questionsData;
        let error;
        ({ data: questionsData, error } = await supabaseClient
          .from('questions')
          .select('*')
          .eq('course_id', currentAssessment.courseId)
          .eq('year', mockExamState.year)
          .limit(currentAssessment.totalQuestions));

        if (!questionsData || questionsData.length === 0) {
           if(!questionsData) throw new Error("No questions found"); 
        }

        // Process questions with Math Fix
        currentAssessment.questions = questionsData.map(item => {
          const questionText = item.question_text || item.question || item.q || 'No question text';
          const options = item.options || item.opts || item.choices || [];
          let answer = item.answer || 0;

          // Normalize Answer
          if (typeof answer === 'string') {
            answer = answer.toUpperCase();
            const map = {'A':0, 'B':1, 'C':2, 'D':3};
            answer = map[answer] !== undefined ? map[answer] : (parseInt(answer) || 0);
          }

          // --- APPLY MATH FIX ---
          const fixedQ = fixMathText(questionText);
          
          // Handle options parsing strings vs arrays
          let parsedOpts = options;
          if (typeof parsedOpts === 'string') {
              try { parsedOpts = JSON.parse(parsedOpts); } catch(e) { parsedOpts = []; }
          }
          
          const fixedOpts = (parsedOpts || []).map(opt => fixMathText(opt));

          return { 
            q: fixedQ, 
            opts: fixedOpts, 
            ans: parseInt(answer),
            course_id: item.course_id
          };
        });

        shuffle(currentAssessment.questions);

        currentAssessment.totalQuestions = currentAssessment.questions.length;
        currentAssessment.answers = Array(currentAssessment.totalQuestions).fill(null);
        currentAssessment.flags = Array(currentAssessment.totalQuestions).fill(false);
        currentAssessment.currentIndex = 0;

        document.getElementById('totalCount').textContent = currentAssessment.totalQuestions;
        buildQGrid();
        renderQuestion(); // This will trigger the math & SMILES render
        startTimer();
        
        showLoading(false);

        console.log('Questions loaded successfully from course ID:', currentAssessment.courseId);

      } catch (error) {
        console.error('Error loading questions:', error);
        showLoading(false);
        let errorMessage = 'Error loading questions. ';
        if (error.message.includes('exam') || error.message.includes('test') || error.message.includes('not found')) {
          errorMessage = error.message;
        } else if (error.message.includes('internet') || error.message.includes('network')) {
          errorMessage = '⚠️ ' + error.message + ' Please check your internet connection.';
        }
        showModal('Error', errorMessage, function() {
          hideModal();
          showStep('stepProgress');
        });
      }
    }

    async function saveTestProgress(score, totalQuestions, correctAnswers, selectedAnswers) {
      try {
        console.log('=== SAVING TEST PROGRESS ===');
        console.log('MAIN SESSION ID:', mockExamState.session_id);
        console.log('Course:', currentAssessment.courseCode);
        
        // **CRITICAL: MUST USE THE MAIN SESSION ID**
        const mainSessionId = mockExamState.session_id;
        
        if (!mainSessionId) {
          console.error('ERROR: No main session ID found! Current mockExamState:', mockExamState);
          return false;
        }
        
        const settings = mockExamState.examSettings[currentAssessment.courseCode] || mockExamState.examSettings.default || {};
        const passMark = settings.test_pass_mark || 20;
        const passed = score >= passMark;

        const testData = {
          auth_id: currentAuthId,
          course_code: currentAssessment.courseCode,
          semester_id: currentAssessment.semesterId,
          session_id: mainSessionId, // **MUST BE SAME AS EXAMS**
          score: score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          time_spent: Math.max(0, (currentAssessment.durationSec || 0) - currentAssessment.durationSec),
          completed: true,
          passed: passed,
          selected_answers: selectedAnswers,
          submitted_at: new Date().toISOString(),
          assessment_type: 'test',
          created_at: new Date().toISOString()
        };

        console.log('SAVING TEST WITH SESSION ID:', mainSessionId);
        console.log('Test data:', JSON.stringify(testData, null, 2));

        const { error } = await supabaseClient
          .from('user_test_progress')
          .insert(testData);

        if (error) {
          console.error('ERROR saving test:', error);
          throw error;
        }

        console.log('✅ TEST SAVED WITH MAIN SESSION ID:', mainSessionId);
        
        // Update session progress
        if (mockExamState.session_progress[currentAssessment.courseCode]) {
          mockExamState.session_progress[currentAssessment.courseCode] = {
            ...mockExamState.session_progress[currentAssessment.courseCode],
            completed: true,
            score: score,
            passed: passed,
            session_id: mainSessionId
          };
        }
        
        return true;
        
      } catch (error) {
        console.error('❌ Error saving test progress:', error);
        return false;
      }
    }

    /***********************
     * SAVE EXAM PROGRESS
     ***********************/
    async function saveExamProgress(score, totalQuestions, correctAnswers, selectedAnswers) {
      try {
        console.log('=== SAVING EXAM PROGRESS ===');
        console.log('MAIN SESSION ID:', mockExamState.session_id);
        
        // **MUST USE MAIN SESSION ID**
        const mainSessionId = mockExamState.session_id;
        
        if (!mainSessionId) {
          console.error('ERROR: No main session ID found!');
          return false;
        }
        
        const settings = mockExamState.examSettings[currentAssessment.courseCode] || mockExamState.examSettings.default || {};
        const passMark = settings.exam_pass_mark || 30;
        const passed = score >= passMark;

        const examData = {
          auth_id: currentAuthId,
          course_code: currentAssessment.courseCode,
          semester_id: currentAssessment.semesterId,
          session_id: mainSessionId, // **SAME AS TESTS**
          score: score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          time_spent: Math.max(0, (currentAssessment.durationSec || 0) - currentAssessment.durationSec),
          completed: true,
          passed: passed,
          selected_answers: selectedAnswers,
          submitted_at: new Date().toISOString(),
          assessment_type: 'exam',
          attempt_number: await getNextAttemptNumber('exam'),
          created_at: new Date().toISOString()
        };

        console.log('SAVING EXAM WITH SESSION ID:', mainSessionId);

        const { error: examError } = await supabaseClient
          .from('user_exam_progress')
          .insert(examData);

        if (examError) throw examError;

        console.log('✅ EXAM SAVED WITH MAIN SESSION ID:', mainSessionId);
        
        // **IMMEDIATELY SAVE FINAL RESULTS**
        await saveFinalResultsForCourse(currentAssessment.courseCode, score, mainSessionId);
        
        // Update session progress
        if (mockExamState.session_progress[currentAssessment.courseCode]) {
          mockExamState.session_progress[currentAssessment.courseCode] = {
            ...mockExamState.session_progress[currentAssessment.courseCode],
            completed: true,
            score: score,
            passed: passed,
            session_id: mainSessionId
          };
        }
        
        return true;
        
      } catch (error) {
        console.error('❌ Error saving exam progress:', error);
        return false;
      }
    }

    async function saveFinalResultsForCourse(courseCode, examScore, sessionId) {
      try {
        console.log(`=== SAVING FINAL RESULTS FOR ${courseCode} ===`);
        console.log('Session ID:', sessionId);
        
        // Get test score for this course (with same session ID)
        const { data: testData, error: testError } = await supabaseClient
          .from('user_test_progress')
          .select('score, session_id')
          .eq('auth_id', currentAuthId)
          .eq('course_code', courseCode)
          .eq('semester_id', mockExamState.semester_id)
          .eq('session_id', sessionId) // **SAME SESSION ID**
          .eq('completed', true)
          .limit(1);

        if (testError) {
          console.error('Error fetching test:', testError);
          return false;
        }

        if (!testData || testData.length === 0) {
          console.log(`❌ No test found for ${courseCode} with session ${sessionId}`);
          console.log('Searching for ANY test for this course...');
          
          // Fallback: get ANY test for this course
          const { data: anyTest } = await supabaseClient
            .from('user_test_progress')
            .select('score, session_id')
            .eq('auth_id', currentAuthId)
            .eq('course_code', courseCode)
            .eq('semester_id', mockExamState.semester_id)
            .eq('completed', true)
            .order('submitted_at', { ascending: false })
            .limit(1);
          
          if (!anyTest || anyTest.length === 0) {
            console.log(`❌ No test found at all for ${courseCode}`);
            return false;
          }
          
          console.log('Found test from different session:', anyTest[0]);
          var test = anyTest[0];
        } else {
          console.log('✅ Found test in same session:', testData[0]);
          var test = testData[0];
        }

        const testScore = test.score || 0;
        const totalScore = testScore + examScore;
        
        const gpa = calculateEnhancedGPA(totalScore);
        const grade = calculateEnhancedGrade(totalScore);
        const passed = totalScore >= 40;

        // **SIMPLE FINAL DATA - Only essential fields**
        const finalData = {
          session_id: sessionId,
          auth_id: currentAuthId,
          course_code: courseCode,
          semester_id: mockExamState.semester_id,
          test_score: testScore,
          exam_score: examScore,
          total_score: totalScore,
          gpa: gpa,
          grade: grade,
          passed: passed,
          calculated_at: new Date().toISOString()
        };

        console.log('Final data to save:', finalData);

        // **SAVE TO user_final_results**
        const { error: saveError } = await supabaseClient
          .from('user_final_results')
          .insert(finalData);

        if (saveError) {
          console.error('❌ Error saving final results:', saveError);
          
          // Try upsert
          const { error: upsertError } = await supabaseClient
            .from('user_final_results')
            .upsert(finalData, {
              onConflict: 'session_id,course_code'
            });
            
          if (upsertError) {
            console.error('❌ Upsert also failed:', upsertError);
            return false;
          }
          
          console.log('✅ Final results saved via upsert');
        } else {
          console.log('✅ Final results saved successfully!');
        }

        // --- START: ADDITION FOR LEADERBOARD (final_gpa) ---
        try {
          console.log('📊 Checking Leaderboard status...');
          
          // 1. Check if user already has a high score
          const { data: currentHigh } = await supabaseClient
            .from('final_gpa')
            .select('gpa')
            .eq('auth_id', currentAuthId)
            .single();

          // 2. Only update if: (User is new) OR (New GPA is higher)
          // This ensures the leaderboard shows their BEST score, not just their LATEST.
          if (!currentHigh || gpa > currentHigh.gpa) {
            
            const { error: lbError } = await supabaseClient
              .from('final_gpa')
              .upsert({
                auth_id: currentAuthId,
                gpa: gpa,
                total_score: totalScore,
                updated_at: new Date().toISOString()
              }, { onConflict: 'auth_id' });

            if (lbError) console.error('⚠️ Leaderboard update warning:', lbError);
            else console.log('🏆 Leaderboard updated with new high score!');
            
          } else {
            console.log('📉 Current score not higher than best. Leaderboard unchanged.');
          }
        } catch (lbEx) {
          // Catch errors silently so we don't break the main function
          console.error('Leaderboard logic error (Non-critical):', lbEx);
        }
        // --- END: ADDITION FOR LEADERBOARD ---

        return true;
        
      } catch (error) {
        console.error('❌ Error in saveFinalResultsForCourse:', error);
        return false;
      }
    }
            
    /***********************
     * GET NEXT ATTEMPT NUMBER
     ***********************/
    async function getNextAttemptNumber(assessmentType) {
      try {
        const tableName = assessmentType === 'test' ? 'user_test_progress' : 'user_exam_progress';
        
        const { data: attempts, error } = await supabaseClient
          .from(tableName)
          .select('attempt_number')
          .eq('auth_id', currentAuthId)
          .eq('course_code', currentAssessment.courseCode)
          .eq('semester_id', currentAssessment.semesterId)
          .order('attempt_number', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (attempts && attempts.length > 0) {
          return (attempts[0].attempt_number || 0) + 1;
        }
        
        return 1;
        
      } catch (error) {
        console.error('Error getting attempt number:', error);
        return 1;
      }
    }

    /***********************
     * CALCULATE ALL FINAL RESULTS (After completing all assessments)
     ***********************/
    async function calculateAllFinalResults() {
      try {
        console.log('=== CALCULATING FINAL RESULTS FOR CURRENT SESSION ===');
        console.log('Main session ID:', mockExamState.session_id);
        
        if (!currentAuthId || !mockExamState.semester_id || !mockExamState.session_id) {
          console.error('Missing required data for final calculation');
          return false;
        }

        const examCourses = mockExamState.courses.filter(course => 
          course.type === 'exam'
        );

        console.log('Exam courses to process:', examCourses);
        
        if (examCourses.length === 0) {
          console.log('No exam courses found to process');
          return false;
        }

        let anyCalculated = false;

        for (const course of examCourses) {
          console.log('Processing final results for:', course.code);
          
          // **FIX: Don't use .single() - use array and check length**
          const { data: testData, error: testError } = await supabaseClient
            .from('user_test_progress')
            .select('score, session_id, submitted_at')
            .eq('auth_id', currentAuthId)
            .eq('course_code', course.code)
            .eq('semester_id', mockExamState.semester_id)
            .eq('session_id', mockExamState.session_id)
            .eq('completed', true)
            .limit(1); // Get array, not single

          if (testError) {
            console.error(`Test error for ${course.code}:`, testError);
            continue;
          }

          if (!testData || testData.length === 0) {
            console.log(`No test found for ${course.code} in current session`);
            // **DEBUG: Check what tests DO exist for this course**
            const { data: allTests } = await supabaseClient
              .from('user_test_progress')
              .select('score, session_id')
              .eq('auth_id', currentAuthId)
              .eq('course_code', course.code)
              .eq('semester_id', mockExamState.semester_id)
              .eq('completed', true);
            console.log(`All tests for ${course.code}:`, allTests);
            continue;
          }

          // **FIX: Same for exams**
          const { data: examData, error: examError } = await supabaseClient
            .from('user_exam_progress')
            .select('score, session_id, submitted_at')
            .eq('auth_id', currentAuthId)
            .eq('course_code', course.code)
            .eq('semester_id', mockExamState.semester_id)
            .eq('session_id', mockExamState.session_id)
            .eq('completed', true)
            .limit(1); // Get array, not single

          if (examError) {
            console.error(`Exam error for ${course.code}:`, examError);
            continue;
          }

          if (!examData || examData.length === 0) {
            console.log(`No exam found for ${course.code} in current session`);
            continue;
          }

          const test = testData[0]; // Get first item from array
          const exam = examData[0]; // Get first item from array
          
          console.log(`Found test/exam pair for ${course.code}:`, { test, exam });

          // Check if final result already exists
          const { data: existingFinal } = await supabaseClient
            .from('user_final_results')
            .select('*')
            .eq('auth_id', currentAuthId)
            .eq('course_code', course.code)
            .eq('semester_id', mockExamState.semester_id)
            .eq('session_id', mockExamState.session_id)
            .limit(1);

          if (existingFinal && existingFinal.length > 0) {
            console.log(`Final result already exists for ${course.code} in this session`);
            anyCalculated = true;
            continue;
          }

          // Calculate final results
          const testScore = test.score || 0;
          const examScore = exam.score || 0;
          const totalScore = testScore + examScore;
          
          const gpa = calculateEnhancedGPA(totalScore);
          const grade = calculateEnhancedGrade(totalScore);
          const passed = totalScore >= 40;

          const finalData = {
            session_id: mockExamState.session_id,
            auth_id: currentAuthId,
            course_code: course.code,
            semester_id: mockExamState.semester_id,
            test_session_id: test.session_id,
            exam_session_id: exam.session_id,
            test_score: testScore,
            exam_score: examScore,
            total_score: totalScore,
            gpa: gpa,
            grade: grade,
            passed: passed,
            calculated_at: new Date().toISOString(),
            created_at: new Date().toISOString() // Ensure created_at is set
          };

          console.log('Saving final results:', finalData);

          try {
            const { error: saveError } = await supabaseClient
              .from('user_final_results')
              .insert(finalData);

            if (saveError) {
              console.error(`Error saving final results for ${course.code}:`, saveError);
              // **TRY SIMPLER INSERT**
              const simplerData = {
                session_id: mockExamState.session_id,
                auth_id: currentAuthId,
                course_code: course.code,
                semester_id: mockExamState.semester_id,
                test_score: testScore,
                exam_score: examScore,
                total_score: totalScore,
                gpa: gpa,
                grade: grade,
                passed: passed,
                calculated_at: new Date().toISOString()
              };
              
              const { error: simpleError } = await supabaseClient
                .from('user_final_results')
                .insert(simplerData);
                
              if (simpleError) {
                console.error(`Simple insert also failed:`, simpleError);
              } else {
                console.log(`Successfully saved final results (simple method)`);
                anyCalculated = true;
              }
            } else {
              console.log(`Successfully saved final results for ${course.code}`);
              anyCalculated = true;
            }
          } catch (saveError) {
            console.error(`Exception saving final results for ${course.code}:`, saveError);
          }
        }

        console.log('=== FINISHED CALCULATING FINAL RESULTS ===');
        console.log('Results calculated:', anyCalculated);
        
        return anyCalculated;
        
      } catch (error) {
        console.error('Error in calculateAllFinalResults:', error);
        return false;
      }
    }

    /***********************
     * ENHANCED GPA CALCULATION
     ***********************/
    function calculateEnhancedGPA(totalScore) {
      // Ensure totalScore is a number
      totalScore = Number(totalScore) || 0;
      
      // 5.00 GPA Scale
      if (totalScore >= 90) return 5.00;
      if (totalScore >= 85) return 4.75;
      if (totalScore >= 80) return 4.50;
      if (totalScore >= 75) return 4.25;
      if (totalScore >= 70) return 4.00;
      if (totalScore >= 65) return 3.75;
      if (totalScore >= 60) return 3.50;
      if (totalScore >= 55) return 3.25;
      if (totalScore >= 50) return 3.00;
      if (totalScore >= 45) return 2.75;
      if (totalScore >= 40) return 2.50;
      if (totalScore >= 35) return 2.25;
      if (totalScore >= 30) return 2.00;
      if (totalScore >= 25) return 1.75;
      if (totalScore >= 20) return 1.50;
      if (totalScore >= 15) return 1.25;
      if (totalScore >= 10) return 1.00;
      return 0.00;
    }

    function calculateEnhancedGrade(totalScore) {
      totalScore = Number(totalScore) || 0;
      
      // Letter grades for 5.00 scale
      if (totalScore >= 90) return 'A+';
      if (totalScore >= 85) return 'A';
      if (totalScore >= 80) return 'A-';
      if (totalScore >= 75) return 'B+';
      if (totalScore >= 70) return 'B';
      if (totalScore >= 65) return 'B-';
      if (totalScore >= 60) return 'C+';
      if (totalScore >= 55) return 'C';
      if (totalScore >= 50) return 'C-';
      if (totalScore >= 45) return 'D+';
      if (totalScore >= 40) return 'D';
      if (totalScore >= 35) return 'D-';
      if (totalScore >= 30) return 'E+';
      if (totalScore >= 25) return 'E';
      if (totalScore >= 20) return 'E-';
      if (totalScore >= 15) return 'F+';
      if (totalScore >= 10) return 'F';
      return 'F';
    }

    /***********************
     * SUBMISSION FUNCTIONS
     ***********************/
    window.confirmSubmit = function() {
      showModal('Submit Assessment', 'Are you sure you want to submit your answers?', () => doSubmit(false));
    };

    async function doSubmit(auto=false){
      try {
        showLoading(true);
        
        // Clear timer
        if(currentAssessment.timerId) {
          clearInterval(currentAssessment.timerId);
          currentAssessment.timerId = null;
        }
        
        // Calculate score
        let score=0;
        currentAssessment.questions.forEach((q,i)=>{ 
          if(currentAssessment.answers[i]===q.ans) score++; 
        });

        // Convert to appropriate scale
        const totalPossible = currentAssessment.questions.length;
        let scaledScore;
        let success = false;
        
        if (currentAssessment.assessmentType === 'test') {
          scaledScore = Math.round((score / totalPossible) * 40);
          success = await saveTestProgress(scaledScore, totalPossible, score, currentAssessment.answers);
        } else {
          scaledScore = Math.round((score / totalPossible) * 60);
          success = await saveExamProgress(scaledScore, totalPossible, score, currentAssessment.answers);
        }

        if (!success) {
          throw new Error('Failed to save progress to database');
        }

        // Show success message
        hideModal();
        setTimeout(() => {
          showModal(
            'Assessment Submitted Successfully!',
            `🎉 Your score: ${scaledScore}/${currentAssessment.assessmentType === 'test' ? '40' : '60'}<br><br>
            <div style="text-align: center; margin: 15px 0;">
              You will be redirected to the progress page in <span id="redirectCountdown">3</span> seconds...
            </div>`,
            function() {
              redirectToProgress();
            }
          );
          
          // Auto-redirect
          let countdown = 3;
          const countdownEl = document.getElementById('redirectCountdown');
          autoRedirectTimer = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (countdown <= 0) {
              clearInterval(autoRedirectTimer);
              redirectToProgress();
            }
          }, 1000);
        }, 300);
        
      } catch (error) {
        console.error('Error submitting assessment:', error);
        showModal('Error', 'Failed to submit assessment. Please try again.', function() {
          hideModal();
          showStep('stepProgress');
        });
      } finally {
        showLoading(false);
      }
    }

    /***********************
     * LOAD FINAL RESULTS FROM user_final_results TABLE
     ***********************/
    async function loadFinalResults() {
      console.log('Loading final results from database...');
      
      const resultsContent = document.getElementById('finalResultsContent');
      const loadingEl = document.getElementById('loadingResults');
      
      resultsContent.innerHTML = '';
      loadingEl.style.display = 'flex';
      
      try {
        if (!currentAuthId || !mockExamState.semester_id || !mockExamState.session_id) {
          throw new Error('Missing session information');
        }

        console.log('Loading final results for session:', mockExamState.session_id);

        // **SIMPLE: Fetch final results using the MAIN session ID**
        const { data: finalResults, error } = await supabaseClient
          .from('user_final_results')
          .select('*')
          .eq('auth_id', currentAuthId)
          .eq('semester_id', mockExamState.semester_id)
          .eq('session_id', mockExamState.session_id) // **FILTER BY MAIN SESSION ID**
          .order('calculated_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        console.log('Final results for current session:', finalResults);
        
        loadingEl.style.display = 'none';
        
        if (!finalResults || finalResults.length === 0) {
          resultsContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
              <div style="font-size: 20px; color: var(--muted);">No final results found for current session.</div>
              <div style="margin-top: 10px;">
                Complete both Test and Exam for courses to see final results.
              </div>
              <button class="btn" onclick="calculateAllFinalResults()" style="margin-top: 20px;">
                Calculate Final Results Now
              </button>
              <div style="margin-top: 20px; font-size: 12px; color: var(--muted);">
                Session: ${mockExamState.session_id}<br>
                Started: ${new Date(mockExamState.started_at).toLocaleTimeString()}
              </div>
            </div>
          `;
          return;
        }

        // Display the results
        displayFinalResults(finalResults);
        
      } catch (error) {
        console.error('Error loading final results:', error);
        loadingEl.style.display = 'none';
        resultsContent.innerHTML = `
          <div style="text-align: center; padding: 20px; color: var(--danger);">
            <div style="font-size: 20px;">⚠️ Error Loading Results</div>
            <div style="margin-top: 10px;">${error.message || 'Database connection error'}</div>
            <button class="btn" onclick="loadFinalResults()" style="margin-top: 20px;">Retry</button>
          </div>
        `;
      }
    }

    // Helper function to get only latest result per course
    function getLatestResultsPerCourse(results) {
      const courseMap = new Map();
      
      results.forEach(result => {
        const existing = courseMap.get(result.course_code);
        if (!existing || new Date(result.calculated_at) > new Date(existing.calculated_at)) {
          courseMap.set(result.course_code, result);
        }
      });
      
      return Array.from(courseMap.values());
    }

    /***********************
     * VIEW FINAL RESULTS
     ***********************/
    window.viewFinalResults = async function() {
      console.log('View Final Results clicked');
      
      // Show loading
      showLoading(true);
      
      try {
        // FIRST: Show the final results step immediately
        showStep('stepFinalResults');
        
        console.log('Loading final results from database...');
        
        // Load and display results
        await loadFinalResults();
        
      } catch (error) {
        console.error('Error loading final results:', error);
        showModal('Error', 
          'Failed to load final results.<br><br>' +
          'Please make sure you have completed both test and exam for your courses.', 
          function() {
            hideModal();
            showStep('stepProgress');
          });
      } finally {
        showLoading(false);
      }
    };

    async function debugFinalResults() {
      console.log('=== DEBUG FINAL RESULTS ===');
      console.log('Current auth ID:', currentAuthId);
      console.log('Current semester ID:', mockExamState.semester_id);
      console.log('Mock exam state:', mockExamState);
      
      // Check existing final results
      const { data: finalResults, error } = await supabaseClient
        .from('user_final_results')
        .select('*')
        .eq('auth_id', currentAuthId)
        .eq('semester_id', mockExamState.semester_id);
      
      console.log('Existing final results:', finalResults);
      console.log('Error:', error);
      
      // Check test progress
      const { data: testProgress } = await supabaseClient
        .from('user_test_progress')
        .select('*')
        .eq('auth_id', currentAuthId)
        .eq('semester_id', mockExamState.semester_id);
      
      console.log('Test progress:', testProgress);
      
      // Check exam progress
      const { data: examProgress } = await supabaseClient
        .from('user_exam_progress')
        .select('*')
        .eq('auth_id', currentAuthId)
        .eq('semester_id', mockExamState.semester_id);
      
      console.log('Exam progress:', examProgress);
    }

    /***********************
     * SHOW STEP FUNCTION
     ***********************/
    function showStep(stepId) {
      console.log('Showing step:', stepId);
      
      // Hide all sections
      document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
      });
      
      // Show the requested section
      const stepElement = document.getElementById(stepId);
      if (stepElement) {
        stepElement.style.display = 'block';
        console.log('Step displayed:', stepId);
      } else {
        console.error('Step element not found:', stepId);
      }
      
      // If showing final results, ensure Start New button is visible
      if (stepId === 'stepFinalResults') {
        showStartNewButton(true);
      }
    }

    /***********************
     * HELPER FUNCTIONS
     ***********************/
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    /***********************
     * REDIRECT TO PROGRESS
     ***********************/
    function redirectToProgress() {
      if (autoRedirectTimer) {
        clearInterval(autoRedirectTimer);
        autoRedirectTimer = null;
      }
      
      showLoading(true);
      setTimeout(() => {
        document.getElementById('refreshNotice').style.display = 'flex';
        showStep('stepProgress');
        showStartNewButton(true);
        
        // Update progress dashboard
        setTimeout(() => {
          updateProgressDashboard();
          showLoading(false);
        }, 500);
      }, 500);
    }

    /***********************
     * EXAM UI FUNCTIONS
     ***********************/
    function startTimer(){
      updateTimerLabel();
      currentAssessment.timerId = setInterval(()=>{
        currentAssessment.durationSec--;
        if(currentAssessment.durationSec<=0){
          clearInterval(currentAssessment.timerId);
          doSubmit(true);
        }
        updateTimerLabel();
      },1000);
    }

    function updateTimerLabel(){
      const m = Math.floor(Math.max(0,currentAssessment.durationSec)/60).toString().padStart(2,'0');
      const s = (Math.max(0,currentAssessment.durationSec)%60).toString().padStart(2,'0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }

    function buildQGrid(){
      const grid = document.getElementById('qGrid');
      grid.innerHTML = '';
      for(let i=0;i<currentAssessment.totalQuestions;i++){
        const b=document.createElement('button');
        b.className='qbtn';
        b.textContent= i+1;
        b.onclick = ()=> gotoQ(i);
        if(currentAssessment.answers[i]!=null) b.classList.add('answered');
        if(currentAssessment.flags[i]) b.classList.add('flag');
        if(i===currentAssessment.currentIndex) b.classList.add('current');
        grid.appendChild(b);
      }
      updateAnsweredCount();
    }

    function updateAnsweredCount(){
      const count = currentAssessment.answers.filter(v=>v!=null).length;
      document.getElementById('answeredCount').textContent = count;
    }

    function renderQuestion(){
      const q = currentAssessment.questions[currentAssessment.currentIndex];
      const qText = document.getElementById('qText');
      const qOptions = document.getElementById('qOptions');
      
      let currentSmilesQueue = [];

      // Parse Q text
      const parsedQ = parseSmilesTags(`${currentAssessment.currentIndex+1}. ${q.q}`);
      currentSmilesQueue.push(...parsedQ.smilesQueue);
      qText.innerHTML = parsedQ.htmlText;
      
      // Parse Options
      qOptions.innerHTML = q.opts.map((t,idx)=>{
        const checked = currentAssessment.answers[currentAssessment.currentIndex]===idx ? 'checked' : '';
        const parsedOpt = parseSmilesTags(t);
        currentSmilesQueue.push(...parsedOpt.smilesQueue);
        return `<label class="opt"><input type="radio" name="opt" value="${idx}" ${checked}> <span>${parsedOpt.htmlText}</span></label>`;
      }).join('');
      
      buildQGrid();
      
      qOptions.querySelectorAll('input[name="opt"]').forEach(inp=>{
        inp.addEventListener('change', e=>{
          currentAssessment.answers[currentAssessment.currentIndex] = parseInt(e.target.value,10);
          buildQGrid();
        });
      });

      // NEW: Draw molecules!
      drawMolecules(currentSmilesQueue);

      // --- TRIGGER MATHJAX ---
      if(window.MathJax) {
          MathJax.typesetPromise([qText, qOptions]).catch(err => console.log(err));
      }
    }

    function gotoQ(i){ currentAssessment.currentIndex=i; renderQuestion(); }
    window.prevQ = function(){ if(currentAssessment.currentIndex>0){ currentAssessment.currentIndex--; renderQuestion(); } }
    window.nextQ = function(){ if(currentAssessment.currentIndex<currentAssessment.totalQuestions-1){ currentAssessment.currentIndex++; renderQuestion(); } }
    window.toggleFlag = function(){ currentAssessment.flags[currentAssessment.currentIndex] = !currentAssessment.flags[currentAssessment.currentIndex]; buildQGrid(); }

    /***********************
     * NAVIGATION & UTILS
     ***********************/
    window.nextStep = function(next) {
      showLoading(true);
      setTimeout(() => {
        mockExamState.currentStep = next;
        showStep('step' + next);
        if (next === 2) initStep2();
        if (next === 3) initStep3();
        if (next === 4) initStep4();
        showLoading(false);
      }, 500);
    };

    window.prevStep = function(prev) {
      showLoading(true);
      setTimeout(() => {
        mockExamState.currentStep = prev;
        showStep('step' + prev);
        showLoading(false);
      }, 500);
    };

    /***********************
     * SWITCH TO EXAMS
     ***********************/
    window.switchToExams = function() {
      showLoading(true);
      setTimeout(() => {
        mockExamState.type = 'exam';
        
        // Generate new session ID for exams
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9);
        mockExamState.session_id = `mock_exam_${timestamp}_${randomStr}`;
        mockExamState.started_at = new Date().toISOString();
        
        // Create exam courses from test courses
        const newCourses = [];
        mockExamState.courses.forEach(testCourse => {
          // Convert test course to exam course
          const examCourse = {
            id: testCourse.id, // Use same ID or adjust as needed
            name: `${testCourse.code} - Exam`,
            type: 'exam',
            credits: testCourse.credits,
            code: testCourse.code
          };
          newCourses.push(examCourse);
        });
        
        mockExamState.courses = newCourses;
        
        // Initialize exam session progress
        mockExamState.session_progress = {};
        mockExamState.courses.forEach(course => {
          const courseCode = course.code;
          mockExamState.session_progress[courseCode] = {
            completed: false,
            score: null,
            started: false,
            assessment_type: 'exam',
            assessment_session_id: null
          };
        });
        
        // Save new session
        saveSessionToStorage();
        
        // Update dashboard
        updateProgressDashboard();
        
        // Update UI
        document.getElementById('progressSubtitle').textContent = `${mockExamState.semester_name} - Exams`;
        document.getElementById('btnTakeExams').style.display = 'none';
        
        showLoading(false);
      }, 500);
    };

    /***********************
     * CHECK TEST COMPLETION BEFORE EXAMS
     ***********************/
    window.checkTestCompletionBeforeExams = async function() {
      if (!currentAuthId || !mockExamState.semester_id) {
        return false;
      }

      // Check if all tests are completed for the selected courses
      for (const course of mockExamState.courses) {
        if (course.type === 'test') {
          const { data: testProgress, error } = await supabaseClient
            .from('user_test_progress')
            .select('completed')
            .eq('auth_id', currentAuthId)
            .eq('course_code', course.code)
            .eq('semester_id', mockExamState.semester_id)
            .eq('completed', true)
            .limit(1);

          if (error || !testProgress || testProgress.length === 0) {
            return false;
          }
        }
      }
      
      return true;
    };

    /***********************
     * START NEW MOCK EXAM
     ***********************/
    window.startNewMockExam = function() {
      console.log('Start New Mock Exam clicked');
      
      showModal('Start New Mock Exam', 
        'Are you sure you want to start a new mock exam?<br><br>' +
        '<strong>This will:</strong><br>' +
        '• Completely reset current session<br>' +
        '• Clear all selected courses<br>' +
        '• Start fresh from instructions<br><br>' +
        'Your previous scores remain saved in Supabase.',
      function() {
        // Hide modal immediately
        hideModal();
        
        // Show loading
        showLoading(true);
        
        // Use setTimeout to allow UI to update before clearing
        setTimeout(() => {
          try {
            // Try to clear session data
            try {
              clearAllSessionData();
            } catch (clearError) {
              console.warn('Partial error clearing session:', clearError);
              // Still try to clear localStorage as fallback
              localStorage.removeItem('mockExamActiveSession');
            }
            
            // Reset all UI elements
            document.getElementById('yearGrid').innerHTML = '';
            document.getElementById('semesterGrid').innerHTML = '';
            document.getElementById('coursesList').innerHTML = '';
            document.getElementById('progressDashboard').innerHTML = '';
            document.getElementById('finalResultsContent').innerHTML = '';
            
            // Reset form elements
            document.getElementById('btnStep1').disabled = true;
            document.getElementById('btnStep2').disabled = true;
            document.getElementById('btnStep3').disabled = true;
            document.getElementById('btnStep4').disabled = true;
            document.getElementById('selectedCount').textContent = '0';
            document.getElementById('examWarning').style.display = 'none';
            document.getElementById('refreshNotice').style.display = 'none';
            
            // Show instructions page
            showStep('stepInstructions');
            showStartNewButton(false);
            
            console.log('Started completely new mock exam session');
            
            // Hide loading after a brief delay
            setTimeout(() => {
              showLoading(false);
            }, 300);
            
          } catch (error) {
            console.error('Critical error in startNewMockExam:', error);
            
            // Last resort: show error and suggest refresh
            showLoading(false);
            showModal('Session Reset Error', 
              'There was an issue resetting the session.<br><br>' +
              'Please try one of these options:<br>' +
              '1. Click "Back to Dashboard" and return<br>' +
              '2. Refresh the page manually (Ctrl+F5)<br>' +
              '3. Clear browser cookies for this site',
              function() {
                hideModal();
                // Optionally redirect to dashboard
                location.href = 'dashboard.html';
              }
            );
          }
        }, 100); // Small delay to ensure modal is hidden
      });
    };

    /***********************
     * LOADING ANIMATION FUNCTIONS
     ***********************/
    function showLoading(show) {
      document.getElementById('globalLoading').style.display = show ? 'flex' : 'none';
    }

    function showStartNewButton(show) {
      document.getElementById('startNewBtn').style.display = show ? 'block' : 'none';
    }

    /***********************
     * REAUTHENTICATION HANDLER
     ***********************/
    async function handleReauthentication() {
      try {
        const storedUser = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
        if (!storedUser || !storedUser.email || !storedUser.password) {
          window.location.href = "index.html";
          return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: storedUser.email,
          password: storedUser.password
        });

        if (error) throw error;
        currentAuthId = data.user.id;
        console.log('Reauthenticated successfully');
      } catch (error) {
        console.error('Reauthentication failed:', error);
        window.location.href = "index.html";
      }
    }

    /***********************
     * CALCULATOR FUNCTIONS
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
     * MODAL FUNCTIONS
     ***********************/
    function showModal(title, msg, onOk) {
      if (autoRedirectTimer) {
        clearInterval(autoRedirectTimer);
        autoRedirectTimer = null;
      }
      
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalMsg').innerHTML = msg;
      const ok = document.getElementById('modalOk');
      ok.onclick = function() { 
        if (onOk) onOk(); 
        hideModal(); 
      };
      document.getElementById('overlay').style.display = 'flex';
    }

    window.hideModal = function() {
      document.getElementById('overlay').style.display = 'none';
    };

    /***********************
     * PROTECTIONS
     ***********************/
    document.addEventListener('contextmenu', e=> e.preventDefault());
    document.addEventListener('keydown', e=>{
      const c = e.ctrlKey || e.metaKey;
      if(c && ['c','x','s','p','u','a'].includes(e.key.toLowerCase())) e.preventDefault();
    });
    document.addEventListener('selectstart', e=>{
      if(['INPUT','TEXTAREA'].includes((e.target.tagName||''))) return;
      e.preventDefault();
    });

    // Network monitoring
    window.addEventListener('online', function() { 
      console.log('Network restored'); 
      if (document.getElementById('networkErrorYears').style.display === 'block' ||
          document.getElementById('networkErrorCourses').style.display === 'block') {
        location.reload();
      }
    });
    window.addEventListener('offline', function() {
      showModal('Network Error', '⚠️ You have lost internet connection.', hideModal);
    });

    // Expose functions to window
    window.proceedToYearSelection = proceedToYearSelection;
    window.nextStep = nextStep;
    window.prevStep = prevStep;
    window.saveCourseSelection = saveCourseSelection;
    window.startAssessment = startAssessment;
    window.viewFinalResults = viewFinalResults;
    window.switchToExams = switchToExams;
    window.startNewMockExam = startNewMockExam;
    window.prevQ = prevQ;
    window.nextQ = nextQ;
    window.toggleFlag = toggleFlag;
    window.confirmSubmit = confirmSubmit;
    window.toggleCalc = toggleCalc;
    window.ins = ins; window.clr = clr; window.del1 = del1; window.evalCalc = evalCalc;
    window.hideModal = hideModal;
    window.reloadProgressDashboard = reloadProgressDashboard;
    window.checkTestCompletionBeforeExams = checkTestCompletionBeforeExams;
    window.calculateAllFinalResults = calculateAllFinalResults;
    window.retakeAssessment = retakeAssessment;

    function displayFinalResults(results) {
      const resultsContent = document.getElementById('finalResultsContent');
      
      if (!results || results.length === 0) {
        resultsContent.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <div style="font-size: 20px; color: var(--muted);">No results to display.</div>
          </div>
        `;
        return;
      }

      // Calculate CGPA based on credit units
      let totalCredits = 0;
      let totalGradePoints = 0;
      let totalCoursesPassed = 0;
      let totalCourses = results.length;
      
      // Get course credits from current session
      results.forEach(result => {
        const course = mockExamState.courses.find(c => c.code === result.course_code);
        const credits = course?.credits || 2;
        
        totalCredits += credits;
        totalGradePoints += (result.gpa || 0) * credits;
        
        if (result.passed) {
          totalCoursesPassed++;
        }
      });
      
      const cgpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '0.00';

      // Generate results table
      let tableHTML = `
        <div class="results-summary">
          <h3 style="margin: 0 0 10px 0;">${mockExamState.semester_name} - Final Results</h3>
          <div class="gpa-display">${cgpa}</div>
          <div style="font-size: 18px; font-weight: 600; color: var(--muted);">Cumulative GPA</div>
          <div style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div>
              <div style="font-size: 14px; color: var(--muted);">Total Credits</div>
              <div style="font-size: 20px; font-weight: 700;">${totalCredits}</div>
            </div>
            <div>
              <div style="font-size: 14px; color: var(--muted);">Courses Completed</div>
              <div style="font-size: 20px; font-weight: 700;">${totalCoursesPassed}/${totalCourses}</div>
            </div>
            <div>
              <div style="font-size: 14px; color: var(--muted);">Status</div>
              <div style="font-size: 20px; font-weight: 700;">
                ${totalCoursesPassed === totalCourses ? '✅ All Passed' : '⚠️ Some Failed'}
              </div>
            </div>
          </div>
          <div style="margin-top: 15px; font-size: 12px; color: var(--muted);">
            Session: ${results[0].session_id?.substring(0, 20)}...
          </div>
        </div>
        
        <table class="results-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Test Score</th>
              <th>Exam Score</th>
              <th>Total Score</th>
              <th>Grade</th>
              <th>GPA</th>
              <th>Status</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      results.forEach(result => {
        const course = mockExamState.courses.find(c => c.code === result.course_code);
        const credits = course?.credits || 2;
        const statusColor = result.passed ? '#10b981' : '#ef4444';
        const statusText = result.passed ? 'PASSED ✓' : 'FAILED ✗';
        
        tableHTML += `
          <tr>
            <td class="course-header">
              <div style="font-weight: 700;">${result.course_code}</div>
              <div style="font-size: 11px; color: var(--muted); word-break: break-all;">
                Session: ${result.session_id?.substring(0, 25)}...
              </div>
            </td>
            <td style="text-align: center;">${result.test_score || 0}/40</td>
            <td style="text-align: center;">${result.exam_score || 0}/60</td>
            <td style="text-align: center; font-weight: 700;">
              ${result.total_score || 0}/100
            </td>
            <td style="text-align: center;">
              <span style="font-weight: 800; font-size: 16px;">${result.grade || 'F'}</span>
            </td>
            <td style="text-align: center;">
              <span style="font-weight: 700; color: ${result.gpa >= 2.0 ? '#10b981' : '#ef4444'}">
                ${result.gpa?.toFixed(2) || '0.00'}
              </span>
            </td>
            <td style="text-align: center;">
              <span class="status-badge" style="background: ${statusColor}20; border-color: ${statusColor}50; color: ${statusColor}">
                ${statusText}
              </span>
            </td>
            <td style="text-align: center;">${credits}</td>
          </tr>
        `;
      });
      
      tableHTML += `
          </tbody>
        </table>
      `;
      
      resultsContent.innerHTML = tableHTML;
    }

    /* --- SIDEBAR FUNCTIONS --- */
    function openSidebar() {
      document.getElementById("mySidebar").style.width = "250px";
    }

    function closeSidebar() {
      document.getElementById("mySidebar").style.width = "0";
    }

    // Close sidebar if clicking outside of it
    document.addEventListener('click', function(event) {
      const sidebar = document.getElementById('mySidebar');
      const menuBtn = document.querySelector('.menu-btn');
      
      if (sidebar.style.width === "250px" && 
          !sidebar.contains(event.target) && 
          !menuBtn.contains(event.target)) {
        closeSidebar();
      }
    });
      
    //Login Protection
    const logged = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
    if (!logged || !logged.email) {
      window.location.href = "index.html";
    }