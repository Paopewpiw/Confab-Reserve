/* Supabase Auth integration for Confab Reserve.
   Profile rows are created by the project's auth.users trigger. */
(function (global) {
  let client = null;
  function getClient() {
    if (client) return client;
    if (!global.supabase || !global.CONFAB_SUPABASE_CONFIG) {
      throw new Error('Supabase library/configuration did not load. Check your internet connection and script tags.');
    }
    client = global.supabase.createClient(
      global.CONFAB_SUPABASE_CONFIG.url,
      global.CONFAB_SUPABASE_CONFIG.anonKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
    );
    return client;
  }
  async function profileFor(authUser) {
    const sb = getClient();
    const { data, error } = await sb.from('profiles').select('id,full_name,student_id,college,email,role').eq('id', authUser.id).single();
    if (error) throw new Error('Signed in, but the profile could not be loaded: ' + error.message);
    return {
      id: data.id, name: data.full_name || authUser.user_metadata?.full_name || authUser.email,
      studentId: data.student_id || '', college: data.college || '', email: data.email || authUser.email,
      role: data.role || 'student'
    };
  }
  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    try { return { user: await profileFor(data.user), session: data.session }; }
    catch (e) { await getClient().auth.signOut(); return { error: e.message }; }
  }
  function isValidStudentId(studentId) {
    return /^2026[0-9]{4}$/.test(String(studentId || '').trim());
  }
  function isXuStudentEmail(email) {
    // Accept only addresses ending in the official student subdomain.
    return /^[A-Z]+@my\.xu\.edu\.ph$/i.test(String(email || '').trim());
  }
  async function signUp(input) {
    const email = String(input.email || '').trim();
    const studentId = String(input.studentId || '').trim();
    if (!isValidStudentId(studentId)) {
      return { error: 'Student ID must contain exactly 8 digits and start with 2026 (example: 20261234).' };
    }
    if (!isXuStudentEmail(email)) {
      return { error: 'Use your XU student email in this format: firstnamelastname@my.xu.edu.ph (letters only before @my.xu.edu.ph).' };
    }
    const { data, error } = await getClient().auth.signUp({
      email, password: input.password,
      options: { data: { full_name: input.name.trim(), student_id: studentId, college: input.college } }
    });
    if (error) return { error: error.message };
    if (!data.session) return { needsEmailConfirmation: true, email };
    try { return { user: await profileFor(data.user), session: data.session }; }
    catch (e) { return { error: e.message }; }
  }
  async function restoreSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return null;
    return profileFor(data.session.user);
  }
  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    return true;
  }
  function onAuthStateChange(callback) {
    return getClient().auth.onAuthStateChange((event, session) => callback(event, session));
  }
  global.ConfabAuthService = { getClient, signIn, signUp, signOut, restoreSession, profileFor, onAuthStateChange, isXuStudentEmail, isValidStudentId };
})(window);

