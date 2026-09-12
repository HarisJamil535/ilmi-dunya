import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "../../assets/logo.png";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Subjects", path: "/subjects" },
  { label: "Practice Tests", path: "/tests" },
  { label: "Video Lectures", path: "/videos" },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinkClasses = ({ isActive }) =>
    `transition-all duration-200 hover:text-indigo-600 hover:scale-105 ${
      isActive
        ? "text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-1"
        : "text-gray-600"
    }`;

  return (
    <header className="sticky top-0 z-50">
      <nav
        className="h-16 w-full border-b border-white/20 bg-white/40 backdrop-blur-lg shadow-[0_4px_30px_rgba(0,0,0,0.08)]"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="Go to homepage"
          >
            <img
              src={logo}
              alt="IlmiDunya logo"
              className="h-12 w-12 object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-indigo-700">
              IlmiDunya
            </span>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <li key={link.path}>
                <NavLink to={link.path} className={navLinkClasses} >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop Auth Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="font-medium text-indigo-600 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-md transition duration-200 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="rounded-md p-2 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
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
            className="border-t border-white/20 bg-white/90 px-6 py-4 shadow-lg backdrop-blur-lg md:hidden"
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
                          ? "text-indigo-600"
                          : "text-gray-700 hover:text-indigo-600"
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
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="font-medium text-indigo-600"
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-center font-medium text-white transition hover:bg-indigo-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;