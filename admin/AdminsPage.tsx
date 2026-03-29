import React, { useState, useEffect } from 'react';
import type { AdminUser, Role } from '../auth/types';
import { useAuthContext } from '../auth/AuthContext';
import { devError } from '../lib/devLog';
import { createAdmin, deleteAdmin, listAdmins, updateAdminRole } from '../services/supabaseAdmin';

const ROLES: Role[] = ['super_admin', 'support', 'moderator'];

const AdminsPage: React.FC = () => {
  const { hasPermission } = useAuthContext();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const canManage = hasPermission('manage_admins');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void listAdmins()
      .then((rows) => {
        if (mounted) setAdmins(rows);
      })
      .catch((e) => {
        devError('listAdmins', e);
        if (mounted) alert('Failed to load admin users.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!canManage) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Access Denied</h2>
        <p className="text-zinc-500 mt-2">You don&apos;t have permission to manage admins.</p>
      </div>
    );
  }

  const refreshAdmins = async () => {
    setAdmins(await listAdmins());
  };

  const handleAdd = async (admin: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) => {
    const res = await createAdmin(admin);
    if ('error' in res) {
      alert(res.error);
      return;
    }
    await refreshAdmins();
    setShowAdd(false);
  };

  const handleUpdateRole = async (id: string, role: Role) => {
    const res = await updateAdminRole(id, role);
    if ('error' in res) {
      alert(res.error);
      return;
    }
    await refreshAdmins();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remove this admin? They will no longer be able to log in.')) {
      const res = await deleteAdmin(id);
      if ('error' in res) {
        alert(res.error);
        return;
      }
      await refreshAdmins();
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Admin Users</h1>
          <p className="text-zinc-500 mt-1">Manage who can access the admin dashboard</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors"
        >
          + Add Admin
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left p-4 text-zinc-500 font-medium text-sm">Name</th>
              <th className="text-left p-4 text-zinc-500 font-medium text-sm">Email</th>
              <th className="text-left p-4 text-zinc-500 font-medium text-sm">Role</th>
              <th className="text-right p-4 text-zinc-500 font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && admins.map((admin) => (
              <tr key={admin.id} className="border-b border-zinc-200 dark:border-zinc-800/50">
                <td className="p-4 font-medium">{admin.name}</td>
                <td className="p-4 text-zinc-600 dark:text-zinc-400">{admin.email}</td>
                <td className="p-4">
                  <select
                    value={admin.role}
                    onChange={(e) => handleUpdateRole(admin.id, e.target.value as Role)}
                    className="bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4 text-right">
                  {admin.role !== 'super_admin' && (
                    <button
                      onClick={() => handleDelete(admin.id)}
                      className="text-red-500 hover:text-red-400 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && admins.length === 0 && (
              <tr>
                <td className="p-4 text-zinc-500" colSpan={4}>
                  No admin users found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="p-4 text-zinc-500" colSpan={4}>
                  Loading admin users...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddAdminModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
};

const AddAdminModal: React.FC<{
  onAdd: (admin: { name: string; email: string; password: string; role: Role }) => void;
  onClose: () => void;
}> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('support');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('All fields required');
      return;
    }
    const admin = { name: name.trim(), email: email.trim().toLowerCase(), role, password };
    onAdd(admin);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
          <h2 className="text-xl font-bold">Add Admin</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
            >
              <option value="support">Support</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminsPage;
