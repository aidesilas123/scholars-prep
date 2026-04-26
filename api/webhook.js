import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. Only accept POST requests from Paystack
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 2. Verify the signature (Security check)
    // We use process.env so your real key stays hidden and safe
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret)
                       .update(JSON.stringify(req.body))
                       .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;

    // 3. If the payment was successful, update the database
    if (event.event === 'charge.success') {
      const { user_id, plan_type } = event.data.metadata;
      
      // Calculate the date based on your table structure
      const expiryDate = (plan_type === 'semester') ? '2026-06-30' : '2026-12-31';

      // 4. Securely talk to Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=minimal' 
        },
        body: JSON.stringify({
          plan_type: plan_type,
          subscription_end: expiryDate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update Supabase profile');
      }
    }

    // 5. Success! Tell Paystack everything is okay
    return res.status(200).send('Webhook Processed');
    
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).send('Internal Server Error');
  }
}