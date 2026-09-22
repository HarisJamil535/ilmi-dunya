import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "../../assets/logo.png";
import { useStudentSession } from "../../auth/useStudentSession";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Subjects", path: "/subjects" },
  { label: "MCQ Tests", path: "/tests" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Video Lectures", path: "/videos" },
  { label: "News", path: "/news" },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = useStudentSession();

  const navLinkClasses = ({ isActive }) =>
    `transition-all duration-200 hover:text-primary hover:scale-105 ${
      isActive
        ? "text-primary font-semibold border-b-2 border-primary pb-1"
        : "text-gray-600"
    }`;

  return (
    <header className="sticky top-0 z-50">
      <nav
        className="h-16 w-full border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="Go to homepage"
          >
            <img
              src={logo}
              alt="IlmiDunya logo"
              width="48"
              height="48"
              className="h-12 w-12 object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-primary-dark">
              IlmiDunya
            </span>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden items-center gap-6 xl:flex">
            {navLinks.map((link) => (
              <li key={link.path}>
                <NavLink to={link.path} className={navLinkClasses} >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop Auth Buttons */}
          <div className="hidden items-center gap-3 xl:flex">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary-muted transition duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Login
                </Link>
                <Link to="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary-muted transition hover:-translate-y-0.5 hover:bg-primary-dark">
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="rounded-md p-2 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div
            id="mobile-menu"
            className="max-h-[calc(100dvh-64px)] overflow-y-auto border-t border-slate-200 bg-white px-6 py-4 shadow-lg xl:hidden"
          >
            <ul className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <NavLink
                    to={link.path}
                   
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block font-medium transition ${
                        isActive
                          ? "text-primary"
                          : "text-gray-700 hover:text-primary"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <hr className="my-4 border-gray-200" />

            <div className="flex flex-col gap-3">
              {isLoggedIn ? (
                <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="rounded-xl bg-primary px-4 py-2 text-center font-bold text-white transition hover:bg-primary-dark">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-center font-bold text-slate-700">
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-xl bg-primary px-4 py-2 text-center font-bold text-white transition hover:bg-primary-dark">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
