
    const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    document.addEventListener('DOMContentLoaded', () => {
        loadLeaderboard();
    });

    async function loadLeaderboard() {
      document.getElementById('loader').style.display = 'flex';
      
      try {
        // 1. Fetch directly from the unique final_gpa table
        // No need to fetch 50 and filter - the DB ensures 1 record per user
        const { data: results, error } = await supabaseClient
          .from('final_gpa')
          .select('*')
          .order('gpa', { ascending: false })
          .limit(20);

        if (error) throw error;

        // 2. Fetch User Profiles
        const authIds = results.map(r => r.auth_id);
        const { data: profiles } = await supabaseClient
          .from('user_profiles') // Ensure this table/view exists
          .select('id, display_name, email')
          .in('id', authIds);

        const profileMap = {};
        if (profiles) profiles.forEach(p => profileMap[p.id] = p);

        // 3. Map Data
        const leaderboardData = results.map((r, index) => {
          const p = profileMap[r.auth_id] || {};
          let name = p.display_name || 'Anonymous';
          if (name === 'Anonymous' && p.email) name = p.email.split('@')[0];
          
          return {
            rank: index + 1,
            name: name,
            gpa: r.gpa,
            score: r.total_score,
            date: new Date(r.updated_at).toLocaleDateString()
          };
        });

        render(leaderboardData);

      } catch (err) {
        console.error(err);
      } finally {
        document.getElementById('loader').style.display = 'none';
      }
    }

    function render(data) {
      const podium = document.getElementById('podium');
      const tbody = document.getElementById('tableBody');
      
      podium.innerHTML = '';
      tbody.innerHTML = '';

      if (data.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
      }

      // Top 3 Podium
      const top3 = data.slice(0, 3);
      const classes = ['first', 'second', 'third'];

      top3.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = `podium-item ${classes[i]}`;
        div.innerHTML = `
          <div class="rank-num">#${u.rank}</div>
          <div class="podium-gpa">${Number(u.gpa).toFixed(2)}</div>
          <div class="podium-name">${u.name}</div>
        `;
        podium.appendChild(div);
      });

      // Full Table (Mobile Responsive Cards)
      data.forEach(u => {
        const row = document.createElement('tr');
        // We use data-label attributes for mobile CSS to grab
        row.innerHTML = `
          <td data-label="Rank">#${u.rank}</td>
          <td data-label="Student">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="avatar-circle">${u.name.charAt(0).toUpperCase()}</span>
              ${u.name}
            </div>
          </td>
          <td data-label="GPA" class="gpa-cell">${Number(u.gpa).toFixed(2)}</td>
          <td data-label="Score">${u.score || 0}</td>
          <td data-label="Date">${u.date}</td>
        `;
        tbody.appendChild(row);
      });
    }
    function render(data) {
      const podium = document.getElementById('podium');
      const tbody = document.getElementById('tableBody');
      
      podium.innerHTML = '';
      tbody.innerHTML = '';

      // Top 3 Podium
      const top3 = data.slice(0, 3);
      const classes = ['first', 'second', 'third'];

      top3.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = `podium-item ${classes[i]}`;
        div.innerHTML = `
          <div class="rank-num">#${u.rank}</div>
          <div class="podium-gpa">${Number(u.gpa).toFixed(2)}</div>
          <div class="podium-name">${u.name}</div>
        `;
        podium.appendChild(div);
      });

      // Full Table
      data.forEach(u => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>#${u.rank}</td>
          <td>
            <div style="display:flex; align-items:center">
              <span class="avatar-circle">${u.name.charAt(0).toUpperCase()}</span>
              ${u.name}
            </div>
          </td>
          <td class="gpa-cell">${Number(u.gpa).toFixed(2)}</td>
          <td>${u.score}</td>
          <td>${u.date}</td>
        `;
        tbody.appendChild(row);
      });
    }