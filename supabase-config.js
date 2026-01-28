// supabase-config.js
(function() {
  // Only initialize once
  if (window.supabaseClient) return;
  
  const SUPABASE_URL = 'https://xtmoolyxxylylttugjek.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bW9vbHl4eHlseWx0dHVnamVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NjE2MjAsImV4cCI6MjA3MTQzNzYyMH0.SKUKEPBGmKKeBlTvmJkcL2CNREfbyyLe61v-XhOIPtI';
  
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase initialized globally');
})();