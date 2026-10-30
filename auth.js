(function (global) {
  const getClient = () => {
    if (!global.StudySpaceSupabase?.configured) {
      throw new Error("Supabase is not configured. Add your project URL and publishable key to supabase-config.js.");
    }
    return global.StudySpaceSupabase.client;
  };

  global.StudySpaceAuth = {
    async getSession() {
      const { data, error } = await getClient().auth.getSession();
      if (error) throw error;
      return data.session;
    },
    onAuthStateChange(callback) {
      return getClient().auth.onAuthStateChange(callback);
    },
    async signIn(email, password) {
      const { data, error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },
    async sendPasswordReset(email) {
      const redirectTo = new URL(global.location.href);
      redirectTo.search = "?mode=recovery";
      redirectTo.hash = "";
      const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: redirectTo.href });
      if (error) throw error;
    },
    async updatePassword(password, fullName) {
      const { data, error } = await getClient().auth.updateUser({
        password,
        data: {
          studyspace_password_setup: true,
          ...(fullName ? { full_name: fullName } : {}),
        },
      });
      if (error) throw error;
      return data.user;
    },
    async updateProfile(userId, profile) {
      const { data, error } = await getClient()
        .from("profiles")
        .update({ full_name: profile.fullName, avatar_url: profile.avatarUrl || null })
        .eq("id", userId)
        .select("id, full_name, email, avatar_url, created_at")
        .single();
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await getClient().auth.signOut();
      if (error) throw error;
    },
  };
})(window);
