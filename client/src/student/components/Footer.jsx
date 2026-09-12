import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube } from "lucide-react";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "Classes", to: "/classes" },
  { label: "Video Lectures", to: "/videos" },
  { label: "Practice Tests", to: "/tests" },
  { label: "Past Papers", to: "/papers" },
];

const boards = [
  { label: "Federal Board", to: "/subjects?board=federal" },
  { label: "Lahore Board", to: "/subjects?board=lahore" },
  { label: "Gujranwala Board", to: "/subjects?board=gujranwala" },
  { label: "Faisalabad Board", to: "/subjects?board=faisalabad" },
  { label: "Rawalpindi Board", to: "/subjects?board=rawalpindi" },
  { label: "Multan Board", to: "/subjects?board=multan" },
];

const socialLinks = [
  {
    label: "Facebook",
    url: "https://facebook.com/your-page",
    icon: Facebook,
  },
  {
    label: "Instagram",
    url: "https://instagram.com/your-page",
    icon: Instagram,
  },
  {
    label: "YouTube",
    url: "https://youtube.com/@your-channel",
    icon: Youtube,
  },
];

const Footer = () => {
  return (
    <footer className="bg-[#1A1A2E] text-gray-300">

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
              <span className="text-indigo-400">Dunya</span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-gray-400">
              Pakistan's trusted educational platform helping students prepare
              for board exams through notes, video lectures, practice tests and
              past papers.
            </p>

            <div className="mt-8 flex items-center gap-4">

              {socialLinks.map((social) => {
                const Icon = social.icon;

                return (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit our ${social.label} page`}
                    className="rounded-xl border border-white/10 p-3 transition-all duration-300 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white"
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
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-indigo-400"
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
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-indigo-400"
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

                <li>
                  <a
                    href="mailto:info@ilmidunya.pk"
                    className="transition-colors hover:text-indigo-400"
                  >
                    info@ilmidunya.pk
                  </a>
                </li>

                <li>
                  <a
                    href="tel:+923000000000"
                    className="transition-colors hover:text-indigo-400"
                  >
                    +92 300 0000000
                  </a>
                </li>

                <li>
                  Lahore, Pakistan
                </li>

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

              <li>
                <Link
                  to="/privacy"
                  className="transition-colors hover:text-indigo-400"
                >
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link
                  to="/terms"
                  className="transition-colors hover:text-indigo-400"
                >
                  Terms of Service
                </Link>
              </li>

            </ul>

          </nav>

        </div>

      </div>

    </footer>
  );
};

export default Footer;