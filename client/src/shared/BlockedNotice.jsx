import { useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, ShieldBan } from "lucide-react";
import "./blocked-notice.css";

export const ACCOUNT_BLOCKED_EVENT = "ilmidunya:account-blocked";

const whatsappLink = (number) => `https://wa.me/${String(number).replace(/[^\d]/g, "")}`;

// Shown whenever the server reports that this student is blocked: at sign-in, sign-up, password reset or mid-session.
export default function BlockedNotice() {
  const [notice, setNotice] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    const show = (event) => setNotice(event.detail || {});
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, show);
    return () => window.removeEventListener(ACCOUNT_BLOCKED_EVENT, show);
  }, []);
  useEffect(() => {
    if (notice && !dialog.current.open) dialog.current.showModal();
    if (!notice && dialog.current.open) dialog.current.close();
  }, [notice]);
  const support = notice?.support || {};
  return <dialog ref={dialog} className="blocked-notice" aria-labelledby="blocked-notice-title" aria-describedby="blocked-notice-copy" onCancel={() => setNotice(null)}>
    <div className="blocked-notice-icon" aria-hidden="true"><span /><ShieldBan size={34} /></div>
    <h2 id="blocked-notice-title">Account blocked</h2>
    <p id="blocked-notice-copy">{notice?.message || "You are blocked from using IlmiDunya. Contact support to unblock your account."}</p>
    {(support.email || support.whatsapp) && <div className="blocked-notice-support">
      {support.whatsapp && <a href={whatsappLink(support.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={18} />WhatsApp support</a>}
      {support.email && <a href={`mailto:${support.email}?subject=${encodeURIComponent("Please unblock my IlmiDunya account")}`}><Mail size={18} />{support.email}</a>}
    </div>}
    <button type="button" className="blocked-notice-close" onClick={() => setNotice(null)}>OK</button>
  </dialog>;
}
