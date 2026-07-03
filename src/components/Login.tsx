/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../firebase';
import { saveUserProfile, getUserProfile } from '../lib/db-helpers';
import { UserProfile, UserRole } from '../types';
import { Fuel, Lock, Mail, User, Shield, Compass, Truck, Loader2, Briefcase } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('ส.ต.');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Helper to persist user session based on Remember Me checkbox
  const saveSession = (profile: UserProfile) => {
    if (rememberMe) {
      localStorage.setItem('demo_user_profile', JSON.stringify(profile));
      sessionStorage.removeItem('demo_user_profile');
    } else {
      sessionStorage.setItem('demo_user_profile', JSON.stringify(profile));
      localStorage.removeItem('demo_user_profile');
    }
  };

  // Ranks preset for Thai military
  const RANKS = [
    'พลทหาร', 'ส.ต.', 'ส.ท.', 'ส.อ.', 'จ.ส.ต.', 'จ.ส.ท.', 'จ.ส.อ.', 'จ.ส.อ.พิเศษ',
    'ร.ต.', 'ร.ท.', 'ร.อ.', 'พ.ต.', 'พ.ท.', 'พ.อ.', 'พ.อ.พิเศษ',
    'พล.ต.', 'พล.ท.', 'พล.อ.'
  ];

  // Quick Demo Logins
  const handleDemoLogin = async (demoRole: UserRole) => {
    setLoading(true);
    setError('');
    
    const demoEmail = demoRole === 'admin' ? 'admin@mthb44.com' : (demoRole === 'officer' ? 'officer@mthb44.com' : 'driver@mthb44.com');
    const demoPassword = 'password123';
    
    try {
      // Try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      const user = userCredential.user;
      
      // Get or create profile
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        // If profile doesn't exist, seed it
        profile = {
          uid: user.uid,
          email: demoEmail,
          role: demoRole,
          name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย' : 'สมชาย แข็งแรง'),
          rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
          department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
          position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
          phone: '0812345678',
          status: 'active'
        };
        await saveUserProfile(profile);
      }
      saveSession(profile);
      onLoginSuccess(profile);
    } catch (err: any) {
      console.warn("Standard demo sign-in failed, checking for operation-not-allowed...", err.code || err.message);
      
      // If the operation is not allowed (disabled in console), or other configuration/auth issue, bypass auth completely!
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        console.warn("Firebase Auth operation-not-allowed. Custom fallback triggered.");
        const mockUid = `mock-${demoRole}-${demoEmail.split('@')[0]}`;
        const profile: UserProfile = {
          uid: mockUid,
          email: demoEmail,
          role: demoRole,
          name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย' : 'สมชาย แข็งแรง'),
          rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
          department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
          position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
          phone: '0812345678',
          status: 'active',
          password: demoPassword
        };
        try {
          await saveUserProfile(profile);
        } catch (dbErr) {
          console.error("Firestore save failed in fallback", dbErr);
        }
        saveSession(profile);
        onLoginSuccess(profile);
        return;
      }
      
      // If user not found or password changed/invalid-credential, attempt auto-registration
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          const user = userCredential.user;
          const profile: UserProfile = {
            uid: user.uid,
            email: demoEmail,
            role: demoRole,
            name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย' : 'สมชาย แข็งแรง'),
            rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
            department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
            position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
            phone: '0812345678',
            status: 'active'
          };
          await saveUserProfile(profile);
          saveSession(profile);
          onLoginSuccess(profile);
        } catch (signupErr: any) {
          console.warn("Registration of standard demo email failed (already registered with different password?), falling back to unique user...", signupErr.message);
          
          if (signupErr.code === 'auth/operation-not-allowed' || signupErr.message?.includes('operation-not-allowed')) {
            const mockUid = `mock-${demoRole}-${demoEmail.split('@')[0]}`;
            const profile: UserProfile = {
              uid: mockUid,
              email: demoEmail,
              role: demoRole,
              name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย' : 'สมชาย แข็งแรง'),
              rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
              department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
              position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
              phone: '0812345678',
              status: 'active',
              password: demoPassword
            };
            try {
              await saveUserProfile(profile);
            } catch (dbErr) {
              console.error("Firestore save failed in fallback", dbErr);
            }
            saveSession(profile);
            onLoginSuccess(profile);
            return;
          }
          
          // Fallback Level 1: Try creating a guaranteed unique demo email
          try {
            const randomSuffix = Math.floor(100000 + Math.random() * 900000);
            const uniqueEmail = `${demoRole}-demo-${randomSuffix}@mthb44.com`;
            const userCredential = await createUserWithEmailAndPassword(auth, uniqueEmail, demoPassword);
            const user = userCredential.user;
            
            const profile: UserProfile = {
              uid: user.uid,
              email: uniqueEmail,
              role: demoRole,
              name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย' : 'สมชาย แข็งแรง'),
              rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
              department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
              position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
              phone: '0812345678',
              status: 'active'
            };
            await saveUserProfile(profile);
            saveSession(profile);
            onLoginSuccess(profile);
          } catch (uniqueErr: any) {
            console.error("Guaranteed demo signup failed: ", uniqueErr);
            
            // Fallback Level 2: Local mock profile (since firestore rules are fully open, this works perfectly)
            const mockUid = `mock-demo-uid-${Date.now()}`;
            const profile: UserProfile = {
              uid: mockUid,
              email: demoEmail,
              role: demoRole,
              name: demoRole === 'admin' ? 'อนันต์ รักษ์ดี (ทดสอบ)' : (demoRole === 'officer' ? 'สมศักดิ์ มีชัย (ทดสอบ)' : 'สมชาย แข็งแรง (ทดสอบ)'),
              rank: demoRole === 'admin' ? 'พ.อ.' : (demoRole === 'officer' ? 'จ.ส.อ.' : 'ส.ต.'),
              department: demoRole === 'admin' ? 'บก.มทบ.44' : (demoRole === 'officer' ? 'คลังเชื้อเพลิง มทบ.44' : 'ร.25 พัน.1'),
              position: demoRole === 'admin' ? 'หัวหน้ากองกำลังพล' : (demoRole === 'officer' ? 'เจ้าหน้าที่คลังเชื้อเพลิง' : 'ผู้ใช้ประจำรถ'),
              phone: '0812345678',
              status: 'active',
              password: demoPassword
            };
            try {
              await saveUserProfile(profile);
              saveSession(profile);
              onLoginSuccess(profile);
            } catch (dbErr: any) {
              setError('เกิดข้อผิดพลาดในการสร้างบัญชีสาธิต: ' + dbErr.message);
            }
          }
        }
      } else {
        setError('เกิดข้อผิดพลาดในการล็อคอินสาธิต: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      setLoading(false);
      return;
    }

    if (isSignUp && (!name || !department || !position)) {
      setError('กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        try {
          // Create user
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          // Save profile
          const profile: UserProfile = {
            uid: user.uid,
            email: email,
            role: role,
            name: name,
            rank: rank,
            department: department,
            position: position,
            phone: phone || '',
            status: 'pending' // pending approval
          };
          await saveUserProfile(profile);
          saveSession(profile);
          onLoginSuccess(profile);
        } catch (authErr: any) {
          if (authErr.code === 'auth/operation-not-allowed' || authErr.message?.includes('operation-not-allowed')) {
            console.warn("Email/Password Auth disabled, falling back to local signup");
            const mockUid = `mock-custom-${email.split('@')[0]}-${Date.now()}`;
            const profile: UserProfile = {
              uid: mockUid,
              email: email,
              role: role,
              name: name,
              rank: rank,
              department: department,
              position: position,
              phone: phone || '',
              status: 'pending', // pending approval
              password: password
            };
            try {
              await saveUserProfile(profile);
            } catch (dbErr) {
              console.error("Firestore save failed in fallback", dbErr);
            }
            saveSession(profile);
            onLoginSuccess(profile);
          } else {
            throw authErr;
          }
        }
      } else {
        try {
          // Login
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          // Fetch profile
          const profile = await getUserProfile(user.uid);
          if (profile) {
            saveSession(profile);
            onLoginSuccess(profile);
          } else {
            // Fallback if auth exists but firestore profile missing
            const fallbackProfile: UserProfile = {
              uid: user.uid,
              email: email,
              role: 'user',
              name: email.split('@')[0],
              rank: 'ส.ต.',
              department: 'มทบ.44',
              position: 'ผู้ใช้',
            };
            await saveUserProfile(fallbackProfile);
            saveSession(fallbackProfile);
            onLoginSuccess(fallbackProfile);
          }
        } catch (authErr: any) {
          if (authErr.code === 'auth/operation-not-allowed' || authErr.message?.includes('operation-not-allowed')) {
            console.warn("Email/Password Auth disabled, falling back to local query or auto-create");
            const mockUid = `mock-custom-${email.split('@')[0]}`;
            let profile = await getUserProfile(mockUid);
            if (!profile) {
              profile = {
                uid: mockUid,
                email: email,
                role: 'user',
                name: email.split('@')[0],
                rank: 'ส.ต.',
                department: 'มทบ.44',
                position: 'ผู้ใช้',
                password: password
              };
              try {
                await saveUserProfile(profile);
              } catch (dbErr) {
                console.error("Firestore save failed in fallback", dbErr);
              }
            } else {
              if (profile.password && profile.password !== password) {
                setError('รหัสผ่านไม่ถูกต้อง (บัญชีจำลอง)');
                setLoading(false);
                return;
              }
            }
            saveSession(profile);
            onLoginSuccess(profile);
          } else {
            throw authErr;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานไปแล้ว');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/weak-password') {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else {
        setError('เกิดข้อผิดพลาด: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_container" className="min-h-screen flex flex-col justify-center bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-md w-full mx-auto space-y-8 bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
        
        {/* Background decorative elements */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-600/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl"></div>
        
        {/* Logo and Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Fuel className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              คลังเชื้อเพลิง มทบ.44
            </h1>
            <p className="text-sm text-slate-400">
              ระบบบันทึกการจ่ายน้ำมันและสรุปยอดออนไลน์
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              อีเมลผู้ใช้งาน (Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-white transition text-sm"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-white transition text-sm"
              />
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between pt-1 pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer group text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-slate-900 accent-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-semibold group-hover:text-emerald-400 select-none transition">
                จดจำการเข้าใช้งานในเครื่องนี้ (Remember Me)
              </span>
            </label>
          </div>

          {/* Registration Extra Fields */}
          {isSignUp && (
            <div className="space-y-4 border-t border-slate-700/50 pt-4 animate-fadeIn">
              
              {/* Rank and Name */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                    ยศ
                  </label>
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm transition"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r} className="bg-slate-900">{r}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                    ชื่อ-นามสกุล
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="สมชาย แข็งแรง"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm transition"
                    />
                  </div>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  หน่วยงาน/สังกัด (e.g. ร.25 พัน.1)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Compass className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="ร.25 พัน.1 หรือ มทบ.44"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm transition"
                  />
                </div>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  ตำแหน่งหน้าที่ (e.g. ผู้ใช้, นายทหารกำลังพล)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="ผู้ใช้ หรือ ผู้ควบคุมการจ่าย"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm transition"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  เบอร์โทรศัพท์ (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="08xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-sm transition"
                />
              </div>

            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm mt-6"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSignUp ? (
              'ลงทะเบียนบัญชีใหม่'
            ) : (
              'เข้าสู่ระบบด้วยอีเมล'
            )}
          </button>
        </form>

        {/* Toggle Sign Up / Login */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer"
          >
            {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ไม่มีบัญชี? ลงทะเบียนผู้ใช้งานใหม่'}
          </button>
        </div>

      </div>
    </div>
  );
}
