
  const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Z-w3oC1ZID4SCOnfnFuAjw_CDow4UHG';
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async () => {
    const userData = JSON.parse(localStorage.getItem('abupq_logged_in_user') || '{}');
    if (!userData.id) {
        window.location.replace('/');
        return;
    }
    currentUser = userData;
    loadHistory();
  });

  async function submitFeedback() {
    const type = document.getElementById('type').value;
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    const btn = document.getElementById('submitBtn');

    if (!subject || !message) {
        alert("Please fill in all fields.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        const { error } = await supabaseClient
            .from('feedback')
            .insert({
                user_id: currentUser.id,
                type: type,
                subject: subject,
                message: message,
                status: 'pending'
            });

        if (error) throw error;

        alert("Thank you! We have received your submission.");
        
        // Reset form
        document.getElementById('subject').value = '';
        document.getElementById('message').value = '';
        
        // Refresh list
        loadHistory();

    } catch (error) {
        console.error("Error submitting:", error);
        alert("Failed to submit. Please try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit";
    }
  }

  async function loadHistory() {
    const list = document.getElementById('historyList');
    
    const { data, error } = await supabaseClient
        .from('feedback')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<div class="empty-state">No submissions yet.</div>';
        return;
    }

    list.innerHTML = data.map(item => `
        <div class="history-item">
            <div>
                <div class="item-meta">
                    ${new Date(item.created_at).toLocaleDateString()} • ${item.type.toUpperCase()}
                </div>
                <div class="item-subject">${escapeHtml(item.subject)}</div>
            </div>
            <div class="badge ${item.status}">${item.status}</div>
        </div>
    `).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
