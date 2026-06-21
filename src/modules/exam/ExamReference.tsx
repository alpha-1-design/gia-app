import React, { useState } from 'react';
import { BarChart3, Award, AlertTriangle, Lightbulb, FileText, X, Search, Trash2 } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import type { LearningProfile } from './types';
import { ASSESSMENT_FILE_KEY } from './types';

interface StoredAssessment {
  fileName: string;
  content: string;
  timestamp: number;
  analysis: {
    weakAreas: { subject: string; topic: string; score: number; recommendations: string[] }[];
    strongAreas: { subject: string; topic: string; score: number }[];
    overallScore: number;
  } | null;
}

function loadAssessments(): StoredAssessment[] {
  try {
    const raw = localStorage.getItem(ASSESSMENT_FILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore parse errors */ }
  return [];
}

function saveAssessments(assessments: StoredAssessment[]) {
  try { localStorage.setItem(ASSESSMENT_FILE_KEY, JSON.stringify(assessments)); } catch { /* quota exceeded */ }
}

interface ExamReferenceProps {
  profile: LearningProfile | null;
  onProfileUpdate: (p: LearningProfile | null) => void;
  onStartQuiz: (subject: string, topic: string) => void;
}

const ExamReference: React.FC<ExamReferenceProps> = ({ profile, onProfileUpdate, onStartQuiz }) => {
  const history = useGiaStore(s => s.examHistory);
  const clearExamHistory = useGiaStore(s => s.clearExamHistory);
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [assessments, setAssessments] = useState<StoredAssessment[]>(() => loadAssessments());
  const [viewing, setViewing] = useState<StoredAssessment | null>(null);

  const filteredHistory = history.filter(r =>
    !search || r.subject.toLowerCase().includes(search.toLowerCase()) || r.examSystem.toLowerCase().includes(search.toLowerCase())
  );

  const clearProfile = () => {
    localStorage.removeItem('gia-learning-profile');
    onProfileUpdate(null);
  };

  const deleteAssessment = (idx: number) => {
    const updated = assessments.filter((_, i) => i !== idx);
    setAssessments(updated);
    saveAssessments(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Profile */}
      {profile && (
        <div className="gia-card p-4 space-y-3">
          <button onClick={() => setShowProfile(e => !e)} className="flex items-center justify-between w-full tap-feedback">
            <div className="flex items-center gap-2">
              <Award size={13} style={{ color: '#f59e0b' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Learning Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{
                background: profile.overallScore >= 70 ? 'rgba(52,211,153,0.15)' : profile.overallScore >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: profile.overallScore >= 70 ? '#34d399' : profile.overallScore >= 40 ? '#f59e0b' : '#f87171',
              }}>
                {profile.overallScore}%
              </span>
              <button onClick={clearProfile} className="text-[10px] text-zinc-600 hover:text-rose-400">Clear</button>
            </div>
          </button>
          {showProfile && (
            <>
              <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                {profile.totalAssessments} assessment{profile.totalAssessments !== 1 ? 's' : ''} · Last updated {new Date(profile.lastUpdated).toLocaleDateString()}
              </p>

              {profile.weakAreas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={11} style={{ color: '#f87171' }} />
                    <span className="text-[10px] font-semibold" style={{ color: '#f87171' }}>Needs Practice</span>
                  </div>
                  {profile.weakAreas.map((w, i) => (
                    <div key={i} className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{w.topic}</span>
                          <span className="text-[9px] ml-2" style={{ color: 'var(--gia-muted-2)' }}>{w.subject}</span>
                        </div>
                        <span className="text-[10px]" style={{ color: '#f87171' }}>{w.score}/100</span>
                      </div>
                      {w.recommendations.length > 0 && (
                        <div className="flex items-start gap-1.5 mt-1">
                          <Lightbulb size={9} style={{ color: '#f59e0b' }} className="mt-0.5 shrink-0" />
                          <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{w.recommendations[0]}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {profile.strongAreas.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Award size={11} style={{ color: '#34d399' }} />
                    <span className="text-[10px] font-semibold" style={{ color: '#34d399' }}>Strong Areas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.strongAreas.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                        {s.topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Assessment Files */}
      <div className="gia-card p-4 space-y-3">
        <button onClick={() => setShowFiles(e => !e)} className="flex items-center justify-between w-full tap-feedback">
          <div className="flex items-center gap-2">
            <FileText size={13} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Assessment Files ({assessments.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{showFiles ? 'Hide' : 'Show'}</span>
          </div>
        </button>
        {showFiles && (
          assessments.length === 0 ? (
            <p className="text-[10px] italic" style={{ color: 'var(--gia-muted)' }}>No files uploaded yet. Upload tests or homework in Setup to build your profile.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {assessments.map((a, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--gia-surface-2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={12} style={{ color: '#a855f7' }} className="shrink-0" />
                      <span className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{a.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewing(viewing?.fileName === a.fileName ? null : a)}
                        className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
                        View
                      </button>
                      <button onClick={() => deleteAssessment(i)} className="text-zinc-600 hover:text-rose-400"><X size={10} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                    <span>{new Date(a.timestamp).toLocaleDateString()}</span>
                    {a.analysis && (
                      <>
                        <span>·</span>
                        <span style={{ color: a.analysis.overallScore >= 70 ? '#34d399' : a.analysis.overallScore >= 40 ? '#f59e0b' : '#f87171' }}>
                          {a.analysis.overallScore}% overall
                        </span>
                        <span>·</span>
                        <span>{a.analysis.weakAreas.length} weak areas</span>
                      </>
                    )}
                  </div>

                  {viewing?.fileName === a.fileName && (
                    <div className="mt-3 space-y-2 pt-2" style={{ borderTop: '1px solid var(--gia-border)' }}>
                      {a.analysis && (
                        <>
                          {a.analysis.weakAreas.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-semibold uppercase" style={{ color: '#f87171' }}>Weak Areas</p>
                              {a.analysis.weakAreas.map((w, wi) => (
                                <div key={wi} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>
                                  <span style={{ color: 'var(--gia-text)' }}>{w.topic}</span>
                                  <span className="ml-2" style={{ color: 'var(--gia-muted)' }}>({w.subject})</span>
                                  {w.recommendations.length > 0 && (
                                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>{w.recommendations[0]}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {a.analysis.strongAreas.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[9px] font-semibold" style={{ color: '#34d399' }}>Strong:</span>
                              {a.analysis.strongAreas.map((s, si) => (
                                <span key={si} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{s.topic}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <details className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                        <summary className="cursor-pointer">Show file content</summary>
                        <pre className="mt-1 max-h-32 overflow-y-auto text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>{a.content}</pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Exam History */}
      <div className="gia-card p-4 space-y-3">
        <button onClick={() => setShowHistory(e => !e)} className="flex items-center justify-between w-full tap-feedback">
          <div className="flex items-center gap-2">
            <BarChart3 size={13} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Exam History ({history.length})</span>
          </div>
        </button>
        {showHistory && (
          <>
            {history.length > 0 && (
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by subject or system..."
                  className="w-full text-[11px] rounded-xl px-7 py-2 border outline-none"
                  style={{ background: 'var(--gia-surface-2)', borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }} />
              </div>
            )}
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <p className="text-[10px] italic" style={{ color: 'var(--gia-muted)' }}>
                  {history.length === 0 ? 'No exam history yet. Complete a quiz to see results here.' : 'No results match your search.'}
                </p>
              ) : (
                filteredHistory.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl tap-feedback" style={{ background: 'var(--gia-surface-2)' }}
                    onClick={() => onStartQuiz(r.subject, r.topic)}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0" style={{
                      background: r.score >= 70 ? 'rgba(52,211,153,0.15)' : r.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: r.score >= 70 ? '#34d399' : r.score >= 40 ? '#f59e0b' : '#f87171',
                    }}>
                      {r.score}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{r.subject}</p>
                      <p className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                        {r.examSystem}{r.topic ? ` · ${r.topic}` : ''} · {r.correct}/{r.total} · {Math.floor(r.timeSpent / 60)}m {r.timeSpent % 60}s
                      </p>
                      {r.weakAreas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.weakAreas.slice(0, 3).map(w => (
                            <span key={w} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[8px] shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                      {new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
            {history.length > 0 && (
              <button onClick={() => { if (confirm('Clear all exam history?')) clearExamHistory(); }}
                className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                <Trash2 size={10} /> Clear History
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExamReference;
