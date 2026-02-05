app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // check user credentials (Supabase / DB)
  const user = await db.users.findOne({ email, password });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  // generate session token
  const sessionToken = Math.random().toString(36).substring(2) + Date.now();

  // save it to DB (invalidate old one)
  await db.users.updateOne({ email }, { $set: { sessionToken } });

  res.json({ user, sessionToken });
});
app.post('/verify-session', async (req, res) => {
  const { email, sessionToken } = req.body;
  const user = await db.users.findOne({ email });

  if (user && user.sessionToken === sessionToken) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});
