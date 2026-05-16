
    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    document.addEventListener('DOMContentLoaded', () => {
      const user = JSON.parse(localStorage.getItem('abupq_logged_in_user') || 'null');
      if (!user) { window.location.replace('/'); return; }
      
      loadHistory(user.id); // Assuming localStorage saves user ID or we fetch it
    });

    async function loadHistory(localUserId) {
      try {
        // 1. Get current authenticated user ID from Supabase directly for security
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user ? user.id : localUserId; // Fallback to local if session logic differs

        if (!userId) throw new Error("User ID not found");

        // 2. Fetch all final results for this user
        const { data: results, error } = await supabaseClient
          .from('user_final_results')
          .select('*')
          .eq('auth_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
          document.getElementById('loader').style.display = 'none';
          document.getElementById('emptyState').style.display = 'block';
          return;
        }

        // 3. Group results by session_id
        const sessions = {};
        results.forEach(record => {
          if (!sessions[record.session_id]) {
            sessions[record.session_id] = {
              id: record.session_id,
              date: new Date(record.created_at || record.calculated_at),
              courses: [],
              totalGPA: 0,
              courseCount: 0
            };
          }
          sessions[record.session_id].courses.push(record);
          sessions[record.session_id].totalGPA += parseFloat(record.gpa || 0);
          sessions[record.session_id].courseCount++;
        });

        // 4. Render Grouped Sessions
        renderSessions(sessions);

      } catch (err) {
        console.error('History Error:', err);
        alert('Failed to load history.');
      } finally {
        document.getElementById('loader').style.display = 'none';
      }
    }

    function renderSessions(sessionsObj) {
      const container = document.getElementById('historyContainer');
      container.innerHTML = '';

      // Convert object to array and sort by date descending
      const sessionArray = Object.values(sessionsObj).sort((a, b) => b.date - a.date);

      sessionArray.forEach(session => {
        // Calculate Average CGPA for this session
        const sessionCGPA = (session.totalGPA / session.courseCount).toFixed(2);
        
        // Format Date
        const dateStr = session.date.toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        });
        const timeStr = session.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Create Card HTML
        const card = document.createElement('div');
        card.className = 'session-card';
        
        // Header HTML
        let html = `
          <div class="session-header" onclick="this.parentElement.classList.toggle('open')">
            <div class="session-info">
              <h3>Mock Exam Session</h3>
              <div class="session-meta">📅 ${dateStr} • ⏰ ${timeStr}</div>
            </div>
            <div class="session-summary">
              <span class="cgpa-badge">CGPA: ${sessionCGPA}</span>
              <span class="toggle-icon">▼</span>
            </div>
          </div>
          
          <div class="session-details">
            <table class="result-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Test Score</th>
                  <th>Exam Score</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>GPA</th>
                </tr>
              </thead>
              <tbody>
        `;

        // Add rows for each course
        session.courses.forEach(course => {
          const gradeClass = `grade-${course.grade.charAt(0)}`; // e.g., grade-A
          html += `
            <tr>
              <td data-label="Course"><strong>${course.course_code}</strong></td>
              <td data-label="Test Score">${course.test_score || 0} / 40</td>
              <td data-label="Exam Score">${course.exam_score || 0} / 60</td>
              <td data-label="Total Score" style="font-weight:700">${course.total_score || 0}</td>
              <td data-label="Grade"><span class="grade-badge ${gradeClass}">${course.grade}</span></td>
              <td data-label="GPA" style="color:var(--accent)">${Number(course.gpa).toFixed(2)}</td>
            </tr>
          `;
        });

        html += `
              </tbody>
            </table>
          </div>
        `;

        card.innerHTML = html;
        container.appendChild(card);
      });
    }
  