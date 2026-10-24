import React, { useState } from 'react';
import {
  Building2,
  Users,
  Plus,
  Shield,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  Phone,
  X,
  Edit,
  Trash2,
} from 'lucide-react';
import { Branch, UserProfile, UserRole } from '../types';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface BranchManagementViewProps {
  branches: Branch[];
  users: UserProfile[];
  currentUser: UserProfile;
  onRefreshData: () => void;
}

export const BranchManagementView: React.FC<BranchManagementViewProps> = ({
  branches,
  users,
  currentUser,
  onRefreshData,
}) => {
  const isOwner = currentUser.role === 'owner';

  // Branch creation state
  const [isNewBranchModalOpen, setIsNewBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // User management state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('staff');
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || !branchCode.trim()) return;

    try {
      const branchId = `branch_${branchCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
      const branchRef = doc(db, 'branches', branchId);
      const now = new Date().toISOString();

      const newBranch: Branch = {
        id: branchId,
        businessId: branches[0]?.businessId || 'biz_apex_auto_1',
        name: branchName.trim(),
        code: branchCode.trim().toUpperCase(),
        location: branchLocation.trim(),
        phone: branchPhone.trim(),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(branchRef, newBranch);
      setIsNewBranchModalOpen(false);
      setBranchName('');
      setBranchCode('');
      setBranchLocation('');
      setBranchPhone('');
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create branch');
    }
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) return;

    try {
      const uid = `user_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const userRef = doc(db, 'users', uid);
      const now = new Date().toISOString();

      const newUser: UserProfile = {
        id: uid,
        businessId: branches[0]?.businessId || 'biz_apex_auto_1',
        email: userEmail.trim(),
        displayName: userDisplayName.trim() || userEmail.split('@')[0],
        role: userRole,
        assignedBranchIds: userRole === 'owner' ? branches.map((b) => b.id) : assignedBranches,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userRef, newUser);
      setIsNewUserModalOpen(false);
      setUserEmail('');
      setUserDisplayName('');
      setAssignedBranches([]);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user profile');
    }
  };

  const toggleBranchAssignment = (bId: string) => {
    setAssignedBranches((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <Building2 className="w-4 h-4" />
            <span>Organization Hierarchy & Role Control</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Branches & User Assignments</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure physical shop branches, define staff roles, and strictly enforce branch isolation per security rules.
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewBranchModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-900/30"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-900/30"
            >
              <Users className="w-4 h-4" /> Add User
            </button>
          </div>
        )}
      </div>

      {/* Branches List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-teal-400" />
          Active Branches ({branches.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {branches.map((branch) => {
            const assignedCount = users.filter((u) =>
              u.assignedBranchIds.includes(branch.id)
            ).length;

            return (
              <div
                key={branch.id}
                className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-300 bg-teal-950 px-2 py-0.5 rounded-lg border border-teal-800">
                    {branch.code}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">{branch.name}</h4>
                  {branch.location && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{branch.location}</span>
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span>{branch.phone}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Assigned Staff:</span>
                  <span className="font-bold text-slate-200">{assignedCount} users</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users & Role Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          Authorized Users & Permissions ({users.length})
        </h3>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Assigned Branches</th>
                  <th className="py-3 px-4 font-semibold">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((user) => {
                  const roleBadge =
                    user.role === 'owner'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : user.role === 'manager'
                      ? 'bg-sky-950 text-sky-300 border-sky-800'
                      : 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{user.displayName}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadge}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.role === 'owner' ? (
                            <span className="text-[11px] text-teal-400 font-semibold">
                              All Branches (Global Access)
                            </span>
                          ) : user.assignedBranchIds.length === 0 ? (
                            <span className="text-[11px] text-slate-500">None</span>
                          ) : (
                            user.assignedBranchIds.map((bId) => {
                              const b = branches.find((item) => item.id === bId);
                              return (
                                <span
                                  key={bId}
                                  className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md border border-slate-700"
                                >
                                  {b?.code || bId}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {user.role === 'owner'
                          ? 'Full Admin: branches, catalog, stock, adjustments, reports'
                          : user.role === 'manager'
                          ? 'Branch Manager: manage inventory, restock, adjustments'
                          : 'Staff: catalog search, point-of-sale, receive stock'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Branch Modal */}
      {isNewBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" /> Create Shop Branch
              </h3>
              <button
                onClick={() => setIsNewBranchModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Northside Auto Depot"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Branch Code (Unique)
                </label>
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="e.g. NORTH-04"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono uppercase text-teal-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Physical Location</label>
                <input
                  type="text"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  placeholder="e.g. 520 Commercial Way, Warehouse #3"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 902-1144"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewBranchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" /> Assign User Role & Branches
              </h3>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="employee@apexauto.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={userDisplayName}
                  onChange={(e) => setUserDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role Permission</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="staff">Staff (Search, Sell, Restock)</option>
                  <option value="manager">Branch Manager (Inventory, Restock, Adjust)</option>
                  <option value="owner">Business Owner (Full Global Authority)</option>
                </select>
              </div>

              {userRole !== 'owner' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Authorized Branch Memberships:
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-950"
                      >
                        <input
                          type="checkbox"
                          checked={assignedBranches.includes(b.id)}
                          onChange={() => toggleBranchAssignment(b.id)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span className="text-slate-200">{b.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({b.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
