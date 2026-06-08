import { useSummarizationStore } from '../../store/useSummarizationStore';
import { useGiaStore } from '../../store/useGiaStore';
import GiaBrain from '../GiaBrain';

const TOKENS_PER_CHAR = 0.25; // Rough estimate
const SAFETY_MARGIN = 2000; // Leave room for system prompt + response

export function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

export function estimateHistoryTokens(history: { role: string; content: string }[]): number {
  return history.reduce((sum, m) => sum + estimateTokens(m.content) + 10, 0);
}

export async function autoSummarizeIfNeeded(
  history: { role: string; content: string }[],
  sessionId: string,
  branchId: string,
  onThought?: (msg: string) => void,
): Promise<{ history: { role: string; content: string }[]; wasSummarized: boolean }> {
  const limit = useSummarizationStore.getState().contextWindowLimit;
  const estimated = estimateHistoryTokens(history);

  if (estimated < limit - SAFETY_MARGIN) {
    return { history, wasSummarized: false };
  }

  const existingSummaries = useSummarizationStore.getState().getSummaries(sessionId, branchId);
  const lastSummaryMsgIndex = existingSummaries.length > 0
    ? Math.max(...existingSummaries.flatMap((s) =>
        s.summarizedMsgIds.map((id) => history.findIndex((m) => m.content.includes(id)))
      ))
    : -1;

  const summaryStart = Math.max(0, lastSummaryMsgIndex + 1);
  const summaryEnd = Math.min(
    history.length - 3, // Keep at least the last 3 messages
    Math.floor(history.length * 0.5) // Summarize roughly half the remaining
  );

  if (summaryEnd <= summaryStart) return { history, wasSummarized: false };

  const toSummarize = history.slice(summaryStart, summaryEnd);
  const toKeep = [...history.slice(0, summaryStart), ...history.slice(summaryEnd)];

  const summaryText = toSummarize
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 2000)}`)
    .join('\n\n');

  try {
    onThought?.('📐 Context window approaching limit — summarizing older messages...');

    const summary = await GiaBrain.generate({
      prompt: `Summarize the following conversation excerpt concisely, preserving key facts, decisions, and context. Focus on information that would be needed to continue the conversation intelligently.\n\n${summaryText}`,
      temperature: 0.3,
      maxTokens: 1024,
    });

    if (!summary.text || summary.text.length < 10) {
      return { history, wasSummarized: false };
    }

    const tokensSaved = estimateHistoryTokens(toSummarize) - estimateTokens(summary.text);
    const summarizedMsgIds = toSummarize.map((m) => m.content.slice(0, 40));

    useSummarizationStore.getState().addSummary(
      sessionId,
      branchId,
      summary.text,
      tokensSaved,
      toSummarize.length,
      summarizedMsgIds,
    );

    const compressedHistory: { role: string; content: string }[] = [
      ...toKeep,
      { role: 'system', content: `[PREVIOUS CONVERSATION SUMMARY]: ${summary.text}` },
    ];

    onThought?.(`✅ Summarized ${toSummarize.length} messages (saved ~${tokensSaved} tokens)`);
    useGiaStore.getState().addNotification(`Auto-summarized ${toSummarize.length} older messages`);

    return { history: compressedHistory, wasSummarized: true };
  } catch {
    return { history, wasSummarized: false };
  }
}
