import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { User, BadgeTier } from '../types';
import { adminStore } from './store';
import { BADGE_TIERS } from '../constants';

const BADGE_OPTIONS = BADGE_TIERS.filter((b) => b.id !== 'none');

const UsersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filterBadge, setFilterBadge] = useState<string>('all');
  const [filterOnline, setFilterOnline] = useState<string>('all');
  const [editing, setEditing] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadUsers = () => setUsers(adminStore.getUsers());

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (editId) {
      const u = users.find((x) => x.id === editId);
      if (u) setEditing(u);
    } else {
      setEditing(null);
    }
  }, [editId, users]);

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.bio.toLowerCase().includes(search.toLowerCase());
    const matchBadge = filterBadge === 'all' || u.badgeTier === filterBadge;
    const matchOnline = filterOnline === 'all' || (filterOnline === 'online' && u.isOnline) || (filterOnline === 'offline' && !u.isOnline);
    return matchSearch && matchBadge && matchOnline;
  });

  const handleSaveEdit = (updates: Partial<User>) => {
    if (!editing) return;
    adminStore.updateUser(editing.id, updates);
    loadUsers();
    setEditing(null);
    setSearchParams({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      adminStore.deleteUser(id);
      loadUsers();
      setEditing(null);
      setSearchParams({});
    }
  };

  const handleAdd = (user: User) => {
    adminStore.addUser(user);
    loadUsers();
    setShowAdd(false);
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Users</h1>
          <p className="text-zinc-500 mt-1">Manage all user accounts</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors"
        >
          + Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 w-64"
        />
        <select
          value={filterBadge}
          onChange={(e) => setFilterBadge(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-rose-500"
        >
          <option value="all">All Badges</option>
          {BADGE_OPTIONS.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterOnline}
          onChange={(e) => setFilterOnline(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-rose-500"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Users table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">User</th>
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">Badge</th>
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">Status</th>
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">Earnings</th>
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">Transferred Out</th>
                <th className="text-left p-4 text-zinc-500 font-medium text-sm">Outstanding</th>
                <th className="text-right p-4 text-zinc-500 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-zinc-500">{u.age} • {u.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg bg-zinc-800 text-sm">{u.badgeTier || 'none'}</span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 text-sm ${u.isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                      {u.isOnline ? 'Online' : 'Offline'}
                      {u.isLive && <span className="text-rose-400">• Live</span>}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400">${(u.earnings ?? 0).toLocaleString()}</td>
                  <td className="p-4 text-zinc-400">${(u.transferredOut ?? 0).toLocaleString()}</td>
                  <td className="p-4 font-medium text-emerald-400">${Math.max(0, (u.earnings ?? 0) - (u.transferredOut ?? 0)).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSearchParams({ edit: u.id })}
                      className="text-rose-500 hover:text-rose-400 font-medium text-sm mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-red-500 hover:text-red-400 font-medium text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <UserEditModal
          user={editing}
          onSave={handleSaveEdit}
          onClose={() => { setEditing(null); setSearchParams({}); }}
          onDelete={() => handleDelete(editing.id)}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <UserAddModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
};

const UserEditModal: React.FC<{
  user: User;
  onSave: (updates: Partial<User>) => void;
  onClose: () => void;
  onDelete: () => void;
}> = ({ user, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState<Partial<User>>({
    name: user.name,
    age: user.age,
    bio: user.bio,
    location: user.location,
    distance: user.distance,
    badgeTier: user.badgeTier,
    isOnline: user.isOnline,
    isLive: user.isLive,
    earnings: user.earnings,
    transferredOut: user.transferredOut,
    interests: user.interests,
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit User</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Name</label>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Age</label>
              <input
                type="number"
                value={form.age ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Distance (miles)</label>
              <input
                type="number"
                value={form.distance ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, distance: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Bio</label>
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Location</label>
            <input
              value={form.location ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Interests (comma-separated)</label>
            <input
              value={Array.isArray(form.interests) ? form.interests.join(', ') : ''}
              onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Badge Tier</label>
            <select
              value={form.badgeTier ?? 'none'}
              onChange={(e) => setForm((f) => ({ ...f, badgeTier: e.target.value as BadgeTier }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            >
              <option value="none">None</option>
              {BADGE_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Earnings ($)</label>
            <input
              type="number"
              value={form.earnings ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, earnings: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Transferred Out ($)</label>
            <input
              type="number"
              value={form.transferredOut ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, transferredOut: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isOnline ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isOnline: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Online</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isLive ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isLive: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Live</span>
            </label>
          </div>
        </div>
        <div className="p-6 border-t border-zinc-800 flex justify-between">
          <button onClick={onDelete} className="text-red-500 hover:text-red-400 font-medium">
            Delete User
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
            <button onClick={() => onSave(form)} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserAddModal: React.FC<{ onAdd: (user: User) => void; onClose: () => void }> = ({ onAdd, onClose }) => {
  const [form, setForm] = useState<Partial<User>>({
    name: '',
    age: 25,
    bio: '',
    avatar: 'https://picsum.photos/seed/new/200',
    interests: [],
    location: '',
    distance: 0,
    isOnline: false,
    isLive: false,
    album: [],
    earnings: 0,
    badgeTier: 'none',
  });

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      alert('Name is required');
      return;
    }
    const id = `user-${Date.now()}`;
    onAdd({
      id,
      name: form.name!,
      age: form.age ?? 25,
      bio: form.bio ?? '',
      avatar: form.avatar ?? 'https://picsum.photos/seed/new/200',
      interests: form.interests ?? [],
      location: form.location ?? '',
      distance: form.distance ?? 0,
      isOnline: form.isOnline ?? false,
      isLive: form.isLive ?? false,
      album: form.album ?? [],
    earnings: form.earnings ?? 0,
    transferredOut: form.transferredOut ?? 0,
    badgeTier: form.badgeTier,
  });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add User</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Name *</label>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Age</label>
              <input
                type="number"
                value={form.age ?? 25}
                onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 25 }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1">Badge</label>
              <select
                value={form.badgeTier ?? 'none'}
                onChange={(e) => setForm((f) => ({ ...f, badgeTier: e.target.value as BadgeTier }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="none">None</option>
                {BADGE_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Bio</label>
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Avatar URL</label>
            <input
              value={form.avatar ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Location</label>
            <input
              value={form.location ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>
        </div>
        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
            Add User
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
