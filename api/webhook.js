import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Unauthorized');

    const event = req.body;

    if (event.event === 'charge.success') {
      const { user_id, plan_type, email } = event.data.metadata;
      const expiryDate = (plan_type === 'semester') ? '2026-06-30' : '2026-12-31';

      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Use POST with resolution=merge-duplicates to handle new OR existing rows
      const response = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify({
          id: user_id,
          email: email,
          plan_type: plan_type,
          subscription_end: expiryDate
        })
      });

      if (!response.ok) throw new Error('Failed to upsert to Supabase');
    }

    return res.status(200).send('Success');
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).send('Error');
  }
}