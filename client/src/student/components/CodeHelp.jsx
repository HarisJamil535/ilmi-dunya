import { useEffect, useState } from "react";
import { Inbox, RotateCw } from "lucide-react";

const WAIT_SECONDS = 60;

// Under a code field: where to look for the e-mail, and a way to get a new code once the one-minute wait is over.
export default function CodeHelp({ sentAt, onResend }) {
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = Math.max(0, WAIT_SECONDS - Math.floor((now - sentAt) / 1000));
  const resend = async () => {
    setSending(true);
    try { await onResend(); } finally { setSending(false); }
  };
  return <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
    <p className="flex items-start gap-2"><Inbox className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Codes usually arrive within a minute. If you cannot find it, check the <strong>Spam</strong>, <strong>Junk</strong> or <strong>Promotions</strong> folder and make sure the email address is correct.</span></p>
    <button type="button" disabled={wait > 0 || sending} onClick={resend} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-black text-primary transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400">
      <RotateCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />{sending ? "Sending..." : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
    </button>
  </div>;
}
