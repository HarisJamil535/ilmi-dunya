import { useContext } from "react";
import { AppContext } from "../../context/AppContext";
import { studyPath } from "../../seo/studyLinks";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube } from "lucide-react";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "Study Library", to: "/learn" },
  { label: "Subjects", to: "/subjects" },
  { label: "Video Lectures", to: "/videos" },
  { label: "Past Papers", to: "/subjects" },
];

const socialLinks = [
  {
    label: "Facebook",
    url: import.meta.env.VITE_FACEBOOK_URL,
    icon: Facebook,
  },
  {
    label: "Instagram",
    url: import.meta.env.VITE_INSTAGRAM_URL,
    icon: Instagram,
  },
  {
    label: "YouTube",
    url: import.meta.env.VITE_YOUTUBE_URL,
    icon: Youtube,
  },
];

const Footer = () => {
  const { boards: availableBoards } = useContext(AppContext);
  const boards = availableBoards.slice(0, 6).map(board => ({ label: board.name, to: studyPath("board", board) }));
  const email = import.meta.env.VITE_CONTACT_EMAIL;
  const legalLinks = [[import.meta.env.VITE_PRIVACY_URL, "Privacy Policy"], [import.meta.env.VITE_TERMS_URL, "Terms of Service"]].filter(([url]) => /^https:\/\//.test(url || ""));
  return (
    <footer className="relative z-10 bg-[#0f172a] text-gray-300">

      {/* Top Footer */}
      <div className="mx-auto max-w-7xl px-6 py-14">

        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <section>

            <Link
              to="/"
              className="inline-block text-3xl font-extrabold tracking-tight text-white"
            >
              Ilmi
              <span className="text-primary-muted">Dunya</span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-gray-400">
              Pakistan's trusted educational platform helping students prepare
              for board exams through notes, video lectures, practice tests and
              past papers.
            </p>

            <div className="mt-8 flex items-center gap-4">

              {socialLinks.filter(item => /^https:\/\//.test(item.url || "")).map((social) => {
                const Icon = social.icon;

                return (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit our ${social.label} page`}
                    className="rounded-xl border border-white/10 p-3 transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}

            </div>

          </section>

          {/* Quick Links */}
          <nav aria-label="Quick Links">

            <h2 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Quick Links
            </h2>

            <ul className="space-y-3">

              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-primary-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}

            </ul>

          </nav>

          {/* Boards */}
          <nav aria-label="Education Boards">

            <h2 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Boards
            </h2>

            <ul className="space-y-3">

              {boards.map((board) => (
                <li key={board.label}>
                  <Link
                    to={board.to}
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-primary-muted"
                  >
                    {board.label}
                  </Link>
                </li>
              ))}

            </ul>

          </nav>

          {/* Contact */}
          <section>

            <h2 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Contact
            </h2>

            <address className="not-italic">

              <ul className="space-y-4 text-sm text-gray-400">

                {email && <li><a href={`mailto:${email}`} className="transition-colors hover:text-primary-muted">{email}</a></li>}
                <li><Link to="/learn">Browse available study resources</Link></li>
              </ul>

            </address>

          </section>

        </div>

      </div>

      {/* Bottom Footer */}
      <div className="border-t border-white/10">

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 py-6 text-sm text-gray-500 md:flex-row">

          <p className="text-center md:text-left">
            © {new Date().getFullYear()} IlmiDunya. All rights reserved.
          </p>

          <nav aria-label="Legal Links">

            <ul className="flex flex-wrap items-center justify-center gap-6">

              {legalLinks.map(([url, label]) => <li key={label}><a href={url} className="transition-colors hover:text-primary-muted">{label}</a></li>)}
            </ul>

          </nav>

        </div>

      </div>

    </footer>
  );
};

export default Footer;
