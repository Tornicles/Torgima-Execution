import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: string;
  estimated_duration_hours: number;
};

type Dashboard = {
  profile: { learningStyle: string; pace: string; retentionRate: number };
  enrollments: Array<{ courseTitle: string; progress_percent: number; status: string; course_id: string }>;
  recommendations: Array<{ courseId: string; title: string; category: string }>;
  mastery: Array<{ concept_id: string; mastery_level: number }>;
};

type LessonPayload = {
  lesson: {
    id: string;
    title: string;
    content_body: string;
    key_concepts: string[];
    reading_time_minutes: number;
  };
  tutor: { explanation: string; keyPoints: string[]; nextSteps: string };
  practiceItems: Array<{ id: string; question_text: string; answer_options?: Record<string, string> }>;
};

export default function AcademyPage() {
  const [, params] = useRoute("/academy/lesson/:lessonId");
  const [, courseParams] = useRoute("/academy/course/:courseId");
  const [location, setLocation] = useLocation();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lesson, setLesson] = useState<LessonPayload | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tutorQ, setTutorQ] = useState("");
  const [tutorA, setTutorA] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const lessonId = params?.lessonId;
  const courseId = courseParams?.courseId;
  const showTutor = location === "/academy/tutor";
  const showProgress = location === "/academy/progress";

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<void>[] = [
      apiGet<Dashboard>("/api/academy/my/dashboard").then((d) => d && setDashboard(d)),
      apiGet<{ courses: Course[] }>("/api/academy/courses").then((d) => d && setCourses(d.courses)),
    ];
    if (showProgress) {
      tasks.push(
        apiGet<Record<string, number>>("/api/academy/my/analytics").then((d) => d && setAnalytics(d)),
      );
    }
    if (lessonId) {
      tasks.push(
        apiGet<LessonPayload>(`/api/academy/lessons/${lessonId}`).then((d) => d && setLesson(d)),
      );
    }
    Promise.all(tasks).finally(() => setLoading(false));
  }, [lessonId, showProgress]);

  async function enroll(id: string) {
    await apiPost(`/api/academy/enroll/${id}`);
    const first = await apiGet<{ lesson: { id: string } }>(`/api/academy/course/${id}/first-lesson`);
    if (first?.lesson?.id) {
      setLocation(`/academy/lesson/${first.lesson.id}`);
      return;
    }
    const d = await apiGet<Dashboard>("/api/academy/my/dashboard");
    if (d) setDashboard(d);
  }

  async function submitPractice(itemId: string) {
    const res = await apiPost<{ evaluation: { feedback: string; correct: boolean } }>(
      `/api/academy/practice/${itemId}/submit`,
      { userAnswer: practiceAnswer },
    );
    if (res?.evaluation) {
      setFeedback(res.evaluation.feedback + (res.evaluation.correct ? " ✓" : ""));
    }
  }

  async function completeLesson() {
    if (!lessonId) return;
    await apiPost(`/api/academy/lessons/${lessonId}/complete`, { score: 85, timeSpentSeconds: 900 });
    setLocation("/academy");
  }

  async function askTutor() {
    const res = await apiPost<{ answer: string }>("/api/academy/tutor-chat/ask", {
      question: tutorQ,
      lessonId,
    });
    if (res?.answer) setTutorA(res.answer);
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground font-mono">Loading Erector Academy…</div>
    );
  }

  if (showTutor) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <Link href="/academy" className="text-xs text-indigo-600 font-mono">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Tutor</h1>
        <textarea
          className="w-full border rounded-lg p-3 text-sm min-h-[100px]"
          placeholder="Ask about a concept…"
          value={tutorQ}
          onChange={(e) => setTutorQ(e.target.value)}
        />
        <Button onClick={() => void askTutor()}>Ask Bhudhi tutor</Button>
        {tutorA ? (
          <Card>
            <CardContent className="pt-4 text-sm whitespace-pre-wrap">{tutorA}</CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  if (showProgress) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/academy" className="text-xs text-indigo-600 font-mono">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Learning progress</h1>
        {analytics ? (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(analytics).map(([k, v]) => (
              <Card key={k}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase">{k.replace(/([A-Z])/g, " $1")}</CardDescription>
                  <CardTitle>{v}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : null}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Concept mastery</h2>
          <ul className="space-y-1 text-sm">
            {(dashboard?.mastery ?? []).map((m) => (
              <li key={m.concept_id} className="flex justify-between border-b py-1">
                <span>{m.concept_id}</span>
                <span className="font-mono">{Math.round(m.mastery_level)}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (lessonId && lesson) {
    const item = lesson.practiceItems[0];
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/academy" className="text-xs text-indigo-600 font-mono">
          ← Dashboard
        </Link>
        <header>
          <h1 className="text-2xl font-bold">{lesson.lesson.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{lesson.lesson.reading_time_minutes} min read</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lesson</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed whitespace-pre-wrap">
            {lesson.tutor.explanation}
          </CardContent>
        </Card>
        {item ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Practice</CardTitle>
              <CardDescription>{item.question_text}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.answer_options
                ? Object.entries(item.answer_options).map(([k, label]) => (
                    <label key={k} className="flex gap-2 text-sm">
                      <input
                        type="radio"
                        name="answer"
                        value={k}
                        checked={practiceAnswer === k}
                        onChange={() => setPracticeAnswer(k)}
                      />
                      {label}
                    </label>
                  ))
                : (
                  <input
                    className="w-full border rounded p-2 text-sm"
                    value={practiceAnswer}
                    onChange={(e) => setPracticeAnswer(e.target.value)}
                  />
                )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void submitPractice(item.id)}>
                  Submit
                </Button>
                <Button onClick={() => void completeLesson()}>Mark complete</Button>
              </div>
              {feedback ? <p className="text-sm text-indigo-700">{feedback}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  if (courseId) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/academy" className="text-xs text-indigo-600 font-mono">
          ← Dashboard
        </Link>
        <p className="mt-4 text-sm text-gray-500">
          Open a lesson from the course catalog on the dashboard (chapter lessons load after enroll).
        </p>
        <Button className="mt-4" onClick={() => void enroll(courseId)}>
          Enroll in this course
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Erector Academy</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Learn any skill</h1>
          <p className="text-sm text-gray-500 mt-2">
            Adaptive courses — personalized by Bhudhi from your learning profile.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/academy/tutor">
            <Button variant="outline" size="sm">
              Tutor chat
            </Button>
          </Link>
          <Link href="/academy/progress">
            <Button variant="outline" size="sm">
              Progress
            </Button>
          </Link>
          <Link href="/knowledge">
            <Button variant="ghost" size="sm">
              Capability paths
            </Button>
          </Link>
        </div>
      </header>

      {dashboard ? (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader>
            <CardTitle className="text-base">Your profile</CardTitle>
            <CardDescription>
              Style: {dashboard.profile.learningStyle} · Pace: {dashboard.profile.pace} · Retention:{" "}
              {Math.round((dashboard.profile.retentionRate ?? 0.7) * 100)}%
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Enrolled</h2>
        {(dashboard?.enrollments ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No enrollments yet — pick a course below.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard!.enrollments.map((e) => (
              <li key={e.course_id} className="text-sm flex justify-between border rounded-lg px-3 py-2">
                <span>{e.courseTitle}</span>
                <span className="font-mono text-indigo-600">{e.progress_percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Courses</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <CardDescription className="line-clamp-2">{c.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500">
                  {c.category} · {c.difficulty_level}
                </span>
                <div className="flex gap-2">
                  <Link href={`/academy/course/${c.id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                  <Button size="sm" onClick={() => void enroll(c.id)}>
                    Enroll
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {courses[0] ? (
        <p className="text-xs text-gray-400">
          After seeding, open a lesson via API{" "}
          <code className="bg-gray-100 px-1 rounded">GET /api/academy/courses</code> then chapters → lessons.
        </p>
      ) : null}
    </div>
  );
}
