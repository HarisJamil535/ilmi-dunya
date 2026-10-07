import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, MailCheck, ShieldCheck } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";
import CustomSelect from "../../shared/CustomSelect";
import StudentAuthShell from "../components/StudentAuthShell";
import { AuthField, AuthSubmit, GoogleIdentityButton, OtpField, PasswordField } from "../components/StudentAuthControls";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialForm = { name: "", email: "", phone: "", gender: "prefer_not_to_say", city: "", school: "", password: "" };

const StudentRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialGoogle = location.state?.googleSignup;
  const [form, setForm] = useState({ ...initialForm, ...(initialGoogle?.profile || {}) });
  const [googleRegistrationToken, setGoogleRegistrationToken] = useState(initialGoogle?.googleRegistrationToken || "");
  const [step, setStep] = useState("profile");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const requestedPath = location.state?.from || sessionStorage.getItem("studentReturnTo") || "/dashboard";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  };

  const enterStudent = (response, title = "Account ready") => {
    localStorage.setItem("studentToken", response.data.token);
    localStorage.setItem("studentName", response.data.student.name);
    localStorage.setItem("studentSchool", response.data.student.school || "");
    notifyStudentAuthChanged();
    sessionStorage.removeItem("studentReturnTo");
    showStudentToast({ type: "success", title, message: `Welcome to IlmiDunya, ${response.data.student.name.split(" ")[0]}.` });
    navigate(returnTo, { replace: true });
  };

  const validateProfile = ({ includePassword = true } = {}) => {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = "Enter your full name.";
    if (!emailPattern.test(form.email.trim())) errors.email = "Enter a valid email address.";
    if (!/^\+?[0-9][0-9\s()-]{7,18}$/.test(form.phone.trim())) errors.phone = "Enter a valid WhatsApp number, e.g. 0300 1234567.";
    if (form.city.trim().length < 2) errors.city = "Enter your city.";
    if (form.school.trim().length < 2) errors.school = 'Enter your school or write "Private Candidate".';
    if (includePassword && !googleRegistrationToken && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) errors.password = "Use at least 8 characters with a letter and number.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const continueFromProfile = (event) => {
    event.preventDefault();
    if (!validateProfile({ includePassword: false })) return;
    if (googleRegistrationToken) requestCode();
    else setStep("security");
  };

  const requestCode = async () => {
    if (!validateProfile()) return;
    setError("");
    setLoading(true);
    try {
      const response = googleRegistrationToken
        ? await axiosInstance.post("/students/register/google-profile", { ...form, googleRegistrationToken })
        : await axiosInstance.post("/students/register", { ...form, channel: "email" });
      if (googleRegistrationToken) return enterStudent(response, "Google account connected");
      setChallengeId(response.data.challengeId || "");
      setStep("verify");
      setOtp("");
      showStudentToast({ type: "success", title: "Code sent", message: response.data.message });
    } catch (err) {
      const message = err.response?.data?.message || "We could not continue. Please check your details and try again.";
      setError(message);
      showStudentToast({ type: "error", title: "Could not continue", message });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (!challengeId) return setError("No active code was found. Go back and request a new verification code.");
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/register/verify", { challengeId, otp });
      enterStudent(response, "Account verified");
    } catch (err) {
      setError(err.response?.data?.message || "That code could not be verified. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential, googleChallengeId, nonce) => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/google", { credential, challengeId: googleChallengeId, nonce });
      if (response.data.needsProfile) {
        setGoogleRegistrationToken(response.data.googleRegistrationToken);
        setForm((current) => ({ ...current, ...response.data.profile }));
        setError("");
        showStudentToast({ type: "success", title: "Google email verified", message: "Complete your student profile to finish creating your account." });
      } else enterStudent(response, "Welcome back");
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-in failed. Try another method.");
    } finally {
      setLoading(false);
    }
  };

  return <StudentAuthShell eyebrow={step === "verify" ? "One last step" : "Student account"} title={step === "verify" ? "Verify your email" : step === "security" ? "Secure your account" : googleRegistrationToken ? "Complete your profile" : "Create your account"} description={step === "verify" ? "Enter the one-time code sent to your email to activate your account." : step === "security" ? "Create a password. We will verify your email before creating the account." : "Join IlmiDunya to save your test history and track your progress."} maxWidth="max-w-xl">
    {step === "verify" ? <form onSubmit={verifyCode} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 sm:space-y-4 sm:rounded-3xl sm:p-6">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm leading-6 text-primary-dark"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary"><MailCheck className="h-5 w-5" /></span><span>{form.email}<br /><strong>Code expires in 10 minutes.</strong></span></div>
      <OtpField value={otp} onChange={setOtp} />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={loading}>Verify and create account</AuthSubmit>
      <button type="button" onClick={() => { setStep("security"); setError(""); setOtp(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" />Change verification method</button>
    </form> : <form onSubmit={step === "security" ? (event) => { event.preventDefault(); requestCode(); } : continueFromProfile} className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl shadow-slate-200/50 [&_input]:min-h-10 [&_input]:px-3 [&_label>span:first-child]:mb-1 [&_label>span:first-child]:text-xs sm:space-y-3 sm:rounded-3xl sm:p-5">
      {step === "profile" && <>
      {!googleRegistrationToken && <>
        <GoogleIdentityButton onCredential={handleGoogleCredential} disabled={loading} intent="signup_with" />
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />or create with email<span className="h-px flex-1 bg-slate-200" /></div>
      </>}
      {googleRegistrationToken && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-black text-emerald-900">Google account verified</p><p className="mt-1 text-xs leading-5 text-emerald-800">Google provided your name and email. Add your WhatsApp number, gender, city and school so IlmiDunya can create your complete student profile.</p></div></div>
      </div>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-3">
        <AuthField label="Full name" autoComplete="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="e.g. Ayesha Khan" error={fieldErrors.name} />
        <AuthField label="Email address" type="email" autoComplete="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@example.com" error={fieldErrors.email} readOnly={Boolean(googleRegistrationToken)} className={googleRegistrationToken ? "[&_input]:bg-slate-50" : ""} />
        <AuthField label="WhatsApp number" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="0300 1234567" error={fieldErrors.phone} />
        <div><CustomSelect label="Gender" value={form.gender} onChange={(gender) => updateField("gender", gender)} placeholder="Prefer not to say" options={[{ value: "prefer_not_to_say", label: "Prefer not to say" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} /></div>
        <AuthField label="City" autoComplete="address-level2" value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="e.g. Lahore" error={fieldErrors.city} />
        <AuthField label="School" autoComplete="organization" value={form.school} onChange={(event) => updateField("school", event.target.value)} placeholder="School or Private Candidate" error={fieldErrors.school} />
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={loading}>{googleRegistrationToken ? <><Check className="h-4 w-4" />Finish creating account</> : "Continue"}</AuthSubmit>
      <p className="text-center text-xs text-slate-500">Already have an account? <Link to="/login" state={{ from: returnTo }} className="font-bold text-primary hover:text-primary-dark">Log in</Link></p>
      </>}
      {step === "security" && <>
        <PasswordField label="Create password" autoComplete="new-password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="At least 8 characters, with a letter and number" error={fieldErrors.password} />
        <div className="flex items-start gap-3 rounded-2xl border border-primary-soft bg-primary-soft/60 p-4 text-sm font-semibold leading-6 text-primary-dark"><MailCheck className="mt-0.5 h-5 w-5 shrink-0" />A six-digit verification code will be sent to <strong className="break-all">{form.email}</strong>.</div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <AuthSubmit loading={loading}>Create account and send code</AuthSubmit>
        <button type="button" onClick={() => { setStep("profile"); setError(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" />Edit your details</button>
      </>}
    </form>}
  </StudentAuthShell>;
};

export default StudentRegister;
