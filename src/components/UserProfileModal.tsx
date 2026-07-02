import React, { useState } from 'react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { 
  X, 
  User, 
  Phone, 
  Briefcase, 
  Lock, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ShieldAlert 
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onProfileUpdated: (updatedProfile: UserProfile) => void;
}

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  onProfileUpdated 
}: UserProfileModalProps) {
  // Profile Fields
  const [name, setName] = useState(currentUser.name || '');
  const [rank, setRank] = useState(currentUser.rank || 'ส.ต.');
  const [department, setDepartment] = useState(currentUser.department || '');
  const [position, setPosition] = useState(currentUser.position || '');
  const [phone, setPhone] = useState(currentUser.phone || '');

  // Password Fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  if (!isOpen) return null;

  const isMockUser = currentUser.uid.startsWith('mock-');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!name.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      setLoading(false);
      return;
    }

    if (!department.trim()) {
      setError('กรุณากรอกสังกัดหน่วยงาน');
      setLoading(false);
      return;
    }

    if (!position.trim()) {
      setError('กรุณากรอกตำแหน่งหน้าที่');
      setLoading(false);
      return;
    }

    try {
      const updatedData: Partial<UserProfile> = {
        name: name.trim(),
        rank: rank,
        department: department.trim(),
        position: position.trim(),
        phone: phone.trim()
      };

      // Save to Firestore using setDoc with merge to support both mock and real users
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, updatedData, { merge: true });

      // Merge and trigger parent state update
      const updatedProfile: UserProfile = {
        ...currentUser,
        ...updatedData
      };
      
      onProfileUpdated(updatedProfile);
      setSuccess('อัปเดตข้อมูลส่วนตัวเสร็จสิ้นเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!currentPassword) {
      setError('กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน');
      setLoading(false);
      return;
    }

    if (!newPassword) {
      setError('กรุณากรอกรหัสผ่านใหม่');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      setLoading(false);
      return;
    }

    if (isMockUser) {
      try {
        const expectedPassword = currentUser.password || 'password123';
        if (currentPassword !== expectedPassword) {
          setError('รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
          setLoading(false);
          return;
        }

        // Save mock password to Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { password: newPassword }, { merge: true });

        // Update local state
        const updatedProfile = {
          ...currentUser,
          password: newPassword
        };
        onProfileUpdated(updatedProfile);

        setSuccess('เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว (บันทึกในระบบจำลอง)');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        console.error('Error changing mock password:', err);
        setError('เกิดข้อผิดพลาดในการบันทึกรหัสผ่านใหม่: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('ไม่พบบัญชีผู้ใช้งานระบบหรือเซสชันหมดอายุ');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Also persist password to firestore for consistency/sync
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, { password: newPassword }, { merge: true });

      // Update local state
      const updatedProfile = {
        ...currentUser,
        password: newPassword
      };
      onProfileUpdated(updatedProfile);

      setSuccess('เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      } else {
        setError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน: ' + (err.message || err));
      }
    } finally {
      setLoading(false);
    }
  };

  const militaryRanks = [
    'พลทหาร', 'ส.ต.', 'ส.ท.', 'ส.อ.', 'จ.ส.ต.', 'จ.ส.ท.', 'จ.ส.อ.', 'จ.ส.อ.พิเศษ',
    'ร.ต.', 'ร.ท.', 'ร.อ.', 'พ.ต.', 'พ.ท.', 'พ.อ.', 'พ.อ.พิเศษ',
    'พล.ต.', 'พล.ท.', 'พล.อ.'
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                ตั้งค่าบัญชี & ข้อมูลส่วนตัว
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            แก้ไขข้อมูลส่วนตัว
          </button>
          <button
            onClick={() => { setActiveTab('password'); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'password'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            เปลี่ยนรหัสผ่าน
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
              <CheckCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'profile' ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              
              <div className="grid grid-cols-3 gap-3">
                {/* Rank */}
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ยศ <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition"
                  >
                    {militaryRanks.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ชื่อ - นามสกุล <span className="text-red-400">*</span>
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
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition"
                    />
                  </div>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  สังกัดหน่วยงาน / กองร้อย <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น มทบ.44 หรือ ร.25 พัน.1"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition"
                />
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ตำแหน่งหน้าที่ <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ผู้ใช้ หรือ นายทหารพัสดุ"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังบันทึกข้อมูล...
                    </>
                  ) : (
                    'บันทึกการแก้ไขข้อมูลส่วนตัว'
                  )}
                </button>
              </div>

            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {isMockUser && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl text-xs flex items-start gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                  <span>นี่คือบัญชีจำลองสำหรับการทดสอบระบบ รหัสผ่านใหม่จะถูกบันทึกไว้ในฐานข้อมูลจำลอง Firestore ของท่าน</span>
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  รหัสผ่านปัจจุบัน <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="ป้อนรหัสผ่านปัจจุบันเพื่อยืนยันตน"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  รหัสผ่านใหม่ <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Key className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Key className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl focus:border-emerald-500 outline-none text-white text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังเปลี่ยนรหัสผ่าน...
                    </>
                  ) : (
                    'อัปเดตรหัสผ่านใหม่'
                  )}
                </button>
              </div>

            </form>
          )}

        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 text-[10px] text-slate-500">
          <span>* จำเป็นต้องกรอก</span>
        </div>

      </div>
    </div>
  );
}
