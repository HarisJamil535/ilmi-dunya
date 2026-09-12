import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Send inputs to backend
      const response = await axiosInstance.post('/admin/login', {
        email, 
        password,
      });
      
      // 2. Extract token from response payload
      const token = response.data.token;
      
      // 3. Store the token safely inside browser localStorage
      localStorage.setItem('adminToken', token);

     
      navigate('/admin/dashboard');
      
    } catch (error) {
      
      console.error("Login Error:", error.response?.data?.message || error.message);
      alert(error.response?.data?.message || "Invalid Email or Password");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f9] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl p-8 shadow-[0_10px_25px_rgba(68,61,215,0.05),0_20px_48px_rgba(0,0,0,0.03)]">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#443dd7] tracking-tight mb-1">
            Ilmi Dunya
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Admin Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ilmidunya.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 text-base border border-slate-200 rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-[#443dd7] focus:ring-4 focus:ring-[#443dd7]/15"
            />
          </div>

          {/* Password Input */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full pl-4 pr-12 py-3 text-base border border-slate-200 rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-[#443dd7] focus:ring-4 focus:ring-[#443dd7]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors duration-150"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 cursor-pointer" strokeWidth={2} />
                ) : (
                  <Eye className="w-5 h-5 cursor-pointer" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3 px-4 bg-[#443dd7] hover:bg-[#332ca6] active:bg-[#262082] text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm shadow-[#443dd7]/20 mt-2"
          >
            Log In
          </button>
        </form>

      </div>
    </div>
  );
}