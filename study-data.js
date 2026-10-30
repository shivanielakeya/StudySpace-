(function (global) {
  const getClient = () => {
    if (!global.StudySpaceSupabase?.configured) {
      throw new Error("Supabase is not configured.");
    }
    return global.StudySpaceSupabase.client;
  };

  function throwIfError(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  global.StudySpaceData = {
    async load(userId) {
      const client = getClient();
      const results = await Promise.all([
        client.from("profiles").select("id, full_name, email, avatar_url, created_at").eq("id", userId).single(),
        client.from("user_settings").select("interval_days, theme_dark, legacy_import_completed_at, has_data").eq("user_id", userId).single(),
        client.from("subjects").select("id, name").eq("user_id", userId).order("name"),
        client.from("topics").select("id, name, subject_id, subjects(name), description, status, level, last_studied, next_revision, revision_count, notes, resource").eq("user_id", userId).order("created_at"),
        client.from("revision_history").select("topic_id, revision_date, level, note, position").eq("user_id", userId).order("position"),
        client.from("study_activities").select("activity_text, topic_name, activity_date, level, activity_type, position").eq("user_id", userId).order("position"),
      ]);
      const [profile, settings, subjects, topics, history, activities] = results.map(throwIfError);
      const historyByTopic = new Map();
      const defaultSubjects = ["Python", "SQL", "Statistics", "Excel", "Power BI", "Machine Learning"];
      const customSubjects = subjects.length !== defaultSubjects.length ||
        defaultSubjects.some((name) => !subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase()));
      const customIntervals = settings.interval_days.some((days, index) => days !== [1, 3, 7, 15, 30][index]);
      history.forEach((entry) => {
        const entries = historyByTopic.get(entry.topic_id) || [];
        entries.push({ date: entry.revision_date, level: entry.level, note: entry.note });
        historyByTopic.set(entry.topic_id, entries);
      });

      return {
        profile,
        hasCloudData: settings.has_data || topics.length > 0 || activities.length > 0 ||
          customSubjects || settings.theme_dark || customIntervals,
        data: {
          topics: topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            subject: topic.subjects.name,
            description: topic.description || "",
            status: topic.status,
            level: topic.level,
            lastStudied: topic.last_studied,
            nextRevision: topic.next_revision,
            revisionCount: topic.revision_count,
            notes: topic.notes || "",
            resource: topic.resource || "",
            history: historyByTopic.get(topic.id) || [],
          })),
          subjects: subjects.map((subject) => subject.name),
          intervals: settings.interval_days,
          dark: settings.theme_dark,
          activities: activities.map((activity) => ({
            text: activity.activity_text,
            topicName: activity.topic_name,
            date: activity.activity_date,
            level: activity.level || "",
            type: activity.activity_type,
          })),
          legacyImportCompletedAt: settings.legacy_import_completed_at,
        },
      };
    },
    async save(data) {
      const payload = {
        subjects: data.subjects,
        topics: data.topics,
        intervals: data.intervals,
        dark: data.dark,
        activities: data.activities.slice(-30).map((activity, index) => ({
          activity_text: activity.text,
          topic_name: activity.topicName,
          activity_date: activity.date,
          level: activity.level || "",
          activity_type: activity.type || "update",
          position: index + 1,
        })),
        legacyImportCompletedAt: data.legacyImportCompletedAt,
      };
      const { error } = await getClient().rpc("save_studyspace_data", { payload });
      if (error) throw error;
    },
  };
})(window);
