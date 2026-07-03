/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Truck, 
  Trash2, 
  Search, 
  UserCheck, 
  X, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Phone, 
  Building,
  Mail,
  Database
} from 'lucide-react';
import { db, doc, deleteDoc, onSnapshot, collection } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { updateUserRole, updateUserStatus } from '../lib/db-helpers';
import DatabaseMigrationModal from './DatabaseMigrationModal';

interface UserMgmtProps {
  currentUser: UserProfile;
}

export default function UserMgmt({ currentUser }: UserMgmtProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>('user');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  // Subscribe to real-time users collection updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: UserProfile[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to users: ", error);
      setErrorMessage("ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: " + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update a user's role
  const handleUpdateRole = async (uid: string) => {
    try {
      setErrorMessage('');
      setSuccessMessage('');
      
      // Prevent admin from removing their own admin role to avoid lockout
      if (uid === currentUser.uid && editingRole !== 'admin') {
        setErrorMessage('คุณไม่สามารถเปลี่ยนบทบาทหน้าที่ของบัญชีตัวเองได้ เพื่อป้องกันปัญหาการเข้าถึงระบบ');
        return;
      }

      await updateUserRole(uid, editingRole);
      setSuccessMessage('อัปเดตบทบาทหน้าที่เรียบร้อยแล้ว');
      setEditingUserId(null);
      
      // Auto clear success message
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // Update a user's ID status
  const handleUpdateStatus = async (uid: string, newStatus: 'pending' | 'active' | 'disabled') => {
    try {
      setErrorMessage('');
      setSuccessMessage('');
      
      // Prevent admin from disabling themselves to avoid lockout
      if (uid === currentUser.uid && newStatus === 'disabled') {
        setErrorMessage('คุณไม่สามารถระงับการใช้งานบัญชีแอดมินของตัวเองได้ เพื่อป้องกันปัญหาการเข้าถึงระบบ');
        return;
      }

      await updateUserStatus(uid, newStatus);
      setSuccessMessage('อัปเดตสถานะเปิดใช้งานไอดีเรียบร้อยแล้ว');
      
      // Auto clear success message
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + err.message);
    }
  };

  // Delete a user profile (with confirmation)
  const handleDeleteUser = async (uid: string, userName: string) => {
    if (uid === currentUser.uid) {
      setErrorMessage('คุณไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
      return;
    }

    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรายชื่อผู้ใช้งาน "${userName}" ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้`);
    if (!confirmDelete) return;

    try {
      setErrorMessage('');
      setSuccessMessage('');
      await deleteDoc(doc(db, 'users', uid));
      setSuccessMessage(`ลบรายชื่อ "${userName}" เรียบร้อยแล้ว`);
      
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการลบผู้ใช้งาน: ' + err.message);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.position && u.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.rank && u.rank.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    const userStatus = u.status || 'active';
    const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div id="user_mgmt_container" className="space-y-6 animate-fadeIn">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-amber-400" />
            ระบบจัดการบทบาทและผู้ใช้งานระบบ
          </h2>
          <p className="text-sm text-slate-400">
            กำหนดสิทธิ์การใช้งานสำหรับ แอดมิน, เจ้าหน้าที่คลัง, และผู้ใช้บริการ (ผู้ใช้)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsMigrationModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/25 text-amber-300 px-3 py-2 rounded-xl hover:bg-amber-500/20 transition cursor-pointer font-semibold shadow-md animate-pulse hover:animate-none"
          >
            <Database className="h-4 w-4 text-amber-400 animate-bounce" />
            ย้ายข้อมูลจาก Firestore
          </button>
          <div className="text-xs bg-slate-800 border border-slate-700/60 px-3 py-2 rounded-xl text-slate-400 font-mono">
            จำนวนผู้ใช้งานทั้งหมด: <span className="text-white font-bold">{users.length}</span> ราย
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm flex items-start gap-3">
          <Check className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Pending users notification banner */}
      {users.filter(u => u.status === 'pending').length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg shadow-amber-500/5">
          <div className="flex items-start gap-3">
            <UserCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">มีกำลังพลสมัครสมาชิกใหม่ รอการอนุมัติเข้าใช้งานระบบ!</p>
              <p className="text-xs text-slate-400 mt-0.5">
                มีกำลังพลจำนวน <span className="text-amber-300 font-bold font-mono">{users.filter(u => u.status === 'pending').length}</span> นาย ที่ลงทะเบียนบัญชีใหม่และยังไม่ถูกอนุมัติเข้าใช้งาน
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer shadow-md"
          >
            แสดงเฉพาะรออนุมัติ
          </button>
        </div>
      )}

      {/* Control Panel: Search & Filter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0f172a]/60 p-4 rounded-2xl border border-slate-800">
        
        {/* Search Input */}
        <div className="md:col-span-2 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="user_search_input"
            type="text"
            placeholder="ค้นหาด้วย ยศ, ชื่อ, อีเมล, หรือสังกัดหน่วยงาน..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white text-sm transition"
          />
        </div>

        {/* Role Filter dropdown */}
        <div>
          <select
            id="user_role_filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white text-sm transition"
          >
            <option value="all" className="bg-slate-900">กรองด้วยบทบาททั้งหมด</option>
            <option value="admin" className="bg-slate-900">แอดมิน (Admin)</option>
            <option value="officer" className="bg-slate-900">เจ้าหน้าที่คลัง (Officer)</option>
            <option value="user" className="bg-slate-900">ผู้ใช้บริการ (User/Driver)</option>
          </select>
        </div>

        {/* Status Filter dropdown */}
        <div>
          <select
            id="user_status_filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white text-sm transition"
          >
            <option value="all" className="bg-slate-900">กรองด้วยสถานะทั้งหมด</option>
            <option value="active" className="bg-slate-900">เปิดใช้งาน (Active)</option>
            <option value="pending" className="bg-slate-900">รออนุมัติเปิดใช้งาน (Pending)</option>
            <option value="disabled" className="bg-slate-900">ระงับการใช้งาน (Disabled)</option>
          </select>
        </div>

      </div>

      {/* Main Table / Grid of Users */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-amber-500" />
          <p className="text-sm">กำลังดึงข้อมูลรายชื่อผู้ใช้งานและบทบาท...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400">
          <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">ไม่พบรายชื่อผู้ใช้งานที่ตรงตามเงื่อนไข</p>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#0f172a]/60 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">ข้อมูลกำลังพล</th>
                  <th className="px-6 py-4">อีเมลผู้ใช้</th>
                  <th className="px-6 py-4">สังกัด/หน่วยงาน</th>
                  <th className="px-6 py-4">เบอร์โทรศัพท์</th>
                  <th className="px-6 py-4">บทบาทสิทธิ์การใช้</th>
                  <th className="px-6 py-4">สถานะ & การเปิดใช้งานไอดี</th>
                  <th className="px-6 py-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.uid} className="hover:bg-slate-800/30 transition duration-150">
                    
                    {/* User Info */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${
                          userItem.role === 'admin' 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                            : userItem.role === 'officer'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {userItem.role === 'admin' ? <User className="h-4.5 w-4.5" /> : userItem.role === 'officer' ? <Shield className="h-4.5 w-4.5" /> : <Truck className="h-4.5 w-4.5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">
                            {userItem.rank} {userItem.name}
                          </p>
                          {userItem.position && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              ตำแหน่ง: {userItem.position}
                            </p>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold mt-1.5 uppercase ${
                            userItem.role === 'admin'
                              ? 'bg-amber-400/10 text-amber-400'
                              : userItem.role === 'officer'
                                ? 'bg-emerald-400/10 text-emerald-400'
                                : 'bg-blue-400/10 text-blue-400'
                          }`}>
                             {userItem.role === 'admin' ? 'แอดมิน' : userItem.role === 'officer' ? 'เจ้าหน้าที่' : 'ผู้ใช้บริการ (ผู้ใช้)'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                      {userItem.email || 'ไม่มีอีเมล'}
                    </td>

                    {/* Department */}
                    <td className="px-6 py-4 text-slate-300">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Building className="h-3.5 w-3.5 text-slate-500" />
                        <span>{userItem.department}</span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                      {userItem.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                          <span>{userItem.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">-</span>
                      )}
                    </td>

                    {/* Role Control */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === userItem.uid ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value as UserRole)}
                            className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-white outline-none focus:border-amber-500"
                          >
                            <option value="user" className="bg-slate-900">ผู้ใช้บริการ</option>
                            <option value="officer" className="bg-slate-900">เจ้าหน้าที่คลัง</option>
                            <option value="admin" className="bg-slate-900">แอดมิน</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(userItem.uid)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                            title="บันทึก"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
                            title="ยกเลิก"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUserId(userItem.uid);
                            setEditingRole(userItem.role);
                          }}
                          className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-medium px-2.5 py-1.5 rounded-lg transition"
                        >
                          เปลี่ยนบทบาทสิทธิ์
                        </button>
                      )}
                    </td>

                    {/* Status & ID Activation system */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 justify-center">
                        <div>
                          {userItem.status === 'pending' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-500/20 animate-pulse">
                              ● รออนุมัติเปิดใช้งาน
                            </span>
                          ) : userItem.status === 'disabled' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-400/10 text-red-400 border border-red-500/20">
                              ● ระงับการใช้งาน
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-500/20">
                              ● เปิดใช้งานปกติ
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {userItem.uid !== currentUser.uid ? (
                            userItem.status === 'pending' ? (
                              <button
                                onClick={() => handleUpdateStatus(userItem.uid, 'active')}
                                className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded transition shadow-md shadow-emerald-500/10 cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                อนุมัติเปิดใช้งาน
                              </button>
                            ) : userItem.status === 'disabled' ? (
                              <button
                                onClick={() => handleUpdateStatus(userItem.uid, 'active')}
                                className="inline-flex items-center gap-1 text-[11px] bg-emerald-700/60 hover:bg-emerald-600 text-emerald-200 border border-emerald-500/30 px-2 py-1 rounded transition cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                ปลดระงับไอดี
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(userItem.uid, 'disabled')}
                                className="inline-flex items-center gap-1 text-[11px] bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-500/20 px-2 py-1 rounded transition cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                                ระงับใช้งาน
                              </button>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">แอดมินปัจจุบัน</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Delete action */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {userItem.uid !== currentUser.uid ? (
                        <button
                          onClick={() => handleDeleteUser(userItem.uid, `${userItem.rank} ${userItem.name}`)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                          title="ลบผู้ใช้งานออกจากฐานข้อมูล"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic pr-2">บัญชีของคุณ</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid View */}
          <div className="block lg:hidden divide-y divide-slate-800">
            {filteredUsers.map((userItem) => (
              <div key={userItem.uid} className="p-4 space-y-3 hover:bg-slate-800/10 transition">
                
                {/* User Info Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      userItem.role === 'admin' 
                        ? 'bg-amber-500/10 text-amber-400' 
                        : userItem.role === 'officer'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {userItem.role === 'admin' ? <User className="h-4 w-4" /> : userItem.role === 'officer' ? <Shield className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">
                        {userItem.rank} {userItem.name}
                      </h4>
                      {userItem.position && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          ตำแหน่ง: {userItem.position}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          userItem.role === 'admin'
                            ? 'bg-amber-400/10 text-amber-400'
                            : userItem.role === 'officer'
                              ? 'bg-emerald-400/10 text-emerald-400'
                              : 'bg-blue-400/10 text-blue-400'
                        }`}>
                          {userItem.role === 'admin' ? 'แอดมิน' : userItem.role === 'officer' ? 'เจ้าหน้าที่' : 'ผู้ใช้บริการ'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[9px] rounded font-mono">
                          {userItem.department}
                        </span>
                      </div>
                    </div>
                  </div>

                  {userItem.uid !== currentUser.uid ? (
                    <button
                      onClick={() => handleDeleteUser(userItem.uid, `${userItem.rank} ${userItem.name}`)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium italic">บัญชีของคุณ</span>
                  )}
                </div>

                {/* Sub details */}
                <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1.5">
                    <span className="text-[10px] text-slate-500 font-sans">สถานะบัญชี:</span>
                    {userItem.status === 'pending' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-500/10 animate-pulse">
                        รออนุมัติเปิดใช้งาน
                      </span>
                    ) : userItem.status === 'disabled' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-400/10 text-red-400 border border-red-500/10">
                        ระงับการใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-500/10">
                        เปิดใช้งานปกติ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    <span>{userItem.email || 'ไม่มีอีเมล'}</span>
                  </div>
                  {userItem.phone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="h-3.5 w-3.5 text-slate-500" />
                      <span>{userItem.phone}</span>
                    </div>
                  )}
                </div>

                {/* Status management section */}
                {userItem.uid !== currentUser.uid && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/40">
                    <span className="text-[11px] text-slate-400">การเปิดใช้งานไอดี:</span>
                    <div>
                      {userItem.status === 'pending' ? (
                        <button
                          onClick={() => handleUpdateStatus(userItem.uid, 'active')}
                          className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded transition cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          อนุมัติเปิดใช้งาน
                        </button>
                      ) : userItem.status === 'disabled' ? (
                        <button
                          onClick={() => handleUpdateStatus(userItem.uid, 'active')}
                          className="inline-flex items-center gap-1 text-[11px] bg-emerald-700/60 hover:bg-emerald-600 text-emerald-200 border border-emerald-500/30 px-2 py-1 rounded transition cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          ปลดระงับไอดี
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(userItem.uid, 'disabled')}
                          className="inline-flex items-center gap-1 text-[11px] bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-500/20 px-2 py-1 rounded transition cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                          ระงับการใช้งาน
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Role management section */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/40">
                  <span className="text-[11px] text-slate-400">สิทธิ์การเข้าถึง:</span>
                  {editingUserId === userItem.uid ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value as UserRole)}
                        className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2 py-1 text-white outline-none focus:border-amber-500"
                      >
                        <option value="user" className="bg-slate-900">ผู้ใช้บริการ</option>
                        <option value="officer" className="bg-slate-900">เจ้าหน้าที่คลัง</option>
                        <option value="admin" className="bg-slate-900">แอดมิน</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(userItem.uid)}
                        className="p-1 bg-emerald-600 text-white rounded transition"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="p-1 bg-slate-700 text-slate-300 rounded transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingUserId(userItem.uid);
                        setEditingRole(userItem.role);
                      }}
                      className="text-[11px] text-amber-400 font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-2 py-1 rounded-lg"
                    >
                      เปลี่ยนสิทธิ์การเข้าถึง
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* Database Migration Modal */}
      <DatabaseMigrationModal 
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
      />

    </div>
  );
}
