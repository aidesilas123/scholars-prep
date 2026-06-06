import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Unauthorized');

    const event = req.body;

    if (event.event === 'charge.success') {
      // 1. Unpack the metadata
      const { user_id, email, target_app } = event.data.metadata;
      
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      let fetchUrl = '';
      let payloadBody = {};

      // 2. ROUTER: Post UTME vs Main App
      if (target_app === 'post_utme') {
          // --- POST UTME APP LOGIC ---
          // Using ?on_conflict=user_email to ensure we update existing emails rather than duplicating
          fetchUrl = `${supabaseUrl}/rest/v1/putme_subscriptions?on_conflict=user_email`;
          
          const today = new Date().toISOString().split('T')[0]; // Gets YYYY-MM-DD
          
          payloadBody = {
              user_email: email,
              plan_name: 'Pro Access',
              status: 'Active',
              start_date: today,
              end_date: '2026-12-31'
          };
      } else {
          // --- MAIN APP (SEMESTER) LOGIC ---
          fetchUrl = `${supabaseUrl}/rest/v1/profiles`;
          
          payloadBody = {
              id: user_id,
              email: email,
              plan_type: 'semester',
              subscription_end: '2026-11-30T23:59:59Z'
          };
      }

      // 3. Execute the Supabase Upsert
      const response = await fetch(fetchUrl, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify(payloadBody)
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Supabase Upsert Failed: ${errorText}`);
      }
    }

    return res.status(200).send('Success');
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).send('Error');
  }
}