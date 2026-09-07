import { useEffect, useState } from 'react';
import { LifeBuoy, Loader2, Check, AlertCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { submitTicket } from '../services/admin';
import { useTranslation } from 'react-i18next';

type Category = 'bug' | 'billing' | 'feature_request' | 'abuse' | 'other';

interface MyTicketRow {
  id: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * The merchant's in-app "contact us" / support ticket interface.
 *
 * Two parts:
 *   1. A form to submit a new ticket → support_tickets table → lands in
 *      the admin panel's B2B Reports tab.
 *   2. A list of the merchant's past tickets with current status + any
 *      admin notes that have been written for them.
 *
 * The merchant only sees their own tickets (RLS policy on the
 * support_tickets table enforces this).
 */
export function GetHelpPanel() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // ----- New ticket form state -----
  const [category, setCategory] = useState<Category>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ----- History state -----
  const [myTickets, setMyTickets] = useState<MyTicketRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      // Merchant's own tickets only; RLS enforces this server-side too.
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, category, subject, status, admin_notes, created_at, resolved_at')
        .eq('source_type', 'merchant')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setMyTickets((data ?? []) as MyTicketRow[]);
    } catch (e) {
      console.error('[get-help] history load failed', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitTicket({
        sourceType: 'merchant',
        merchantId: user.id,
        category,
        subject,
        body,
      });
      // Reset the form, show success, reload history.
      setSubject('');
      setBody('');
      setCategory('bug');
      setSubmittedAt(Date.now());
      await loadHistory();
      setTimeout(() => setSubmittedAt(null), 5000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('dash.help.errSend', { defaultValue: 'Could not send. Try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2 flex items-center gap-2">
          <LifeBuoy className="w-7 h-7 text-gray-500" /> {t('dash.help.title', { defaultValue: 'Get help' })}
        </h1>
        <p className="text-gray-500 text-sm md:text-base">
          {t('dash.help.sub', { defaultValue: 'Have an issue, suggestion, or question? Send us a message — we usually reply within 1 business day.' })}
        </p>
      </header>

      {/* ---------- New ticket form ---------- */}
      <div className="bg-white border notion-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold">{t('dash.help.sendMessage', { defaultValue: 'Send us a message' })}</h2>

        {submittedAt && (
          <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2 text-sm text-green-800">
            <Check className="w-4 h-4 flex-shrink-0" />
            {t('dash.help.gotIt', { defaultValue: "Got it. We'll get back to you by email at" })} <strong className="ml-1">{user?.email}</strong>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 block">{t('dash.help.aboutLabel', { defaultValue: "What's this about?" })}</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {([
                ['bug', t('dash.help.catBug', { defaultValue: '🐛 Bug' })],
                ['billing', t('dash.help.catBilling', { defaultValue: '💳 Billing' })],
                ['feature_request', t('dash.help.catFeature', { defaultValue: '💡 Feature' })],
                ['abuse', t('dash.help.catAbuse', { defaultValue: '⚠️ Abuse' })],
                ['other', t('dash.help.catOther', { defaultValue: '💬 Other' })],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCategory(val)}
                  className={`text-xs px-2 py-2 rounded-md border transition ${
                    category === val
                      ? 'bg-[#37352F] text-white border-[#37352F]'
                      : 'bg-white notion-border hover:bg-[#F7F7F5]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 block">{t('dash.help.subject', { defaultValue: 'Subject' })}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('dash.help.subjectPh', { defaultValue: 'e.g. Scanner not detecting QR codes' })}
              maxLength={140}
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 block">{t('dash.help.bodyLabel', { defaultValue: "Tell us what's going on" })}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder={t('dash.help.bodyPh', { defaultValue: 'Describe the issue, what you tried, and any error messages...' })}
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20 resize-none"
            />
            <p className="text-[11px] text-gray-400">
              {t('dash.help.noSecrets', { defaultValue: "Don't include passwords or payment details. Screenshots help — paste them in an email reply after submitting." })}
            </p>
          </div>

          {submitError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!subject.trim() || !body.trim() || submitting}
              className="bg-[#37352F] text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {t('dash.help.send', { defaultValue: 'Send message' })}
            </button>
          </div>
        </form>
      </div>

      {/* ---------- Past tickets ---------- */}
      <div className="bg-white border notion-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          {t('dash.help.pastMessages', { defaultValue: 'Your past messages' })}
          <span className="text-xs text-gray-400 font-normal">({myTickets.length})</span>
        </h2>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : myTickets.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8">
            {t('dash.help.noneSent', { defaultValue: "You haven't sent us anything yet." })}
          </div>
        ) : (
          <div className="space-y-2">
            {myTickets.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: MyTicketRow }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const statusColor: Record<string, string> = {
    open: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-200 text-gray-600',
  };
  return (
    <div className="border notion-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 hover:bg-[#FBFBFA] transition flex items-start gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${statusColor[ticket.status] ?? ''}`}>
              {t(`dash.help.status.${ticket.status}`, { defaultValue: ticket.status.replace('_', ' ') })}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {t(`dash.help.cat.${ticket.category}`, { defaultValue: ticket.category.replace('_', ' ') })}
            </span>
            <span className="text-sm font-medium truncate">{ticket.subject}</span>
          </div>
          <div className="text-xs text-gray-500">
            {t('dash.help.sent', { defaultValue: 'Sent' })} {new Date(ticket.created_at).toLocaleString()}
            {ticket.resolved_at && ` · ${t('dash.help.resolved', { defaultValue: 'Resolved' })} ${new Date(ticket.resolved_at).toLocaleDateString()}`}
          </div>
        </div>
      </button>
      {expanded && ticket.admin_notes && (
        <div className="border-t notion-border px-3 py-2 bg-[#F7F7F5] text-xs">
          <div className="font-medium text-gray-500 mb-1">{t('dash.help.noteFromSupport', { defaultValue: 'Note from support:' })}</div>
          <div className="whitespace-pre-wrap text-gray-700">{ticket.admin_notes}</div>
        </div>
      )}
      {expanded && !ticket.admin_notes && (
        <div className="border-t notion-border px-3 py-2 bg-[#F7F7F5] text-xs text-gray-400 italic">
          {t('dash.help.noReply', { defaultValue: "No reply yet. We'll respond by email at the address on your account." })}
        </div>
      )}
    </div>
  );
}
