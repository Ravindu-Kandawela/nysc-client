import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, Shield } from 'lucide-react';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({
    institute_name: '',
    teacher_name: '',
    teacher_designation: 'ICT Instructor',
    service_no: '',
    teacher_phone: '',
    center_in_charge_name: '',
    center_in_charge_title: 'මධ්‍යස්ථාන භාර නිලධාරී',
    course_title: '',
    org_name_si: 'ජාතික තරුණ සේවා සභාව',
    centre_name_si: 'තාක්ෂණික පුහුණු මධ්‍යස්ථානය - අකුරැස්ස',
    target_hours_per_month: '120'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    newPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings(prev => ({ ...prev, ...res })))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));

    api.get('/auth/me')
      .then(res => {
        if (res && res.user) {
          setProfileForm({
            name: res.user.name || '',
            email: res.user.email || '',
            newPassword: ''
          });
        }
      })
      .catch(e => console.warn(e));
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.put('/auth/profile', profileForm);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      setSettings(s => ({ ...s, teacher_name: profileForm.name }));
    } catch (err) {
      alert(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Institute & Teacher Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Configuration used for reports, signatures, and printing headers</p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold text-center">
          ✓ Settings saved successfully!
        </div>
      )}

      {/* Instructor Account & Login Profile */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Instructor Account & Login Credentials</h3>
            <p className="text-xs text-slate-500">Update your login email, display name, and password anytime</p>
          </div>
          {profileSuccess && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              ✓ Profile Updated!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Instructor Name:</label>
            <input
              type="text"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email Address:</label>
            <input
              type="email"
              required
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm font-semibold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (leave blank if keeping current password):
            </label>
            <input
              type="password"
              placeholder="Enter at least 4 characters to change password..."
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
        </div>

        <div className="pt-3 border-t flex justify-end">
          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> {profileSaving ? 'Updating...' : 'Update Login Profile'}
          </button>
        </div>
      </form>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b pb-3 font-bold text-sm text-slate-800">
          Teacher Details (ඉදිරිපත් කළේ)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher Full Name:</label>
            <input
              type="text"
              value={settings.teacher_name}
              onChange={(e) => setSettings({ ...settings, teacher_name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Designation (තනතුර):</label>
            <input
              type="text"
              value={settings.teacher_designation}
              onChange={(e) => setSettings({ ...settings, teacher_designation: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Service Number (සේවා අංකය):</label>
            <input
              type="text"
              value={settings.service_no}
              onChange={(e) => setSettings({ ...settings, service_no: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (දු.ක.අංකය):</label>
            <input
              type="text"
              value={settings.teacher_phone}
              onChange={(e) => setSettings({ ...settings, teacher_phone: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
        </div>

        <div className="border-b pt-4 pb-3 font-bold text-sm text-slate-800">
          Institute & Approver Details (අනුමත කළේ)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Centre in Charge (නම):</label>
            <input
              type="text"
              value={settings.center_in_charge_name}
              onChange={(e) => setSettings({ ...settings, center_in_charge_name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">In-Charge Title (තනතුර):</label>
            <input
              type="text"
              value={settings.center_in_charge_title}
              onChange={(e) => setSettings({ ...settings, center_in_charge_title: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Approver Name (අනුමත කළේ / නිලධාරී):</label>
            <input
              type="text"
              value={settings.approver_name || ''}
              onChange={(e) => setSettings({ ...settings, approver_name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hours / Month (මාසික ඉලක්ක පැය):</label>
            <input
              type="number"
              value={settings.target_hours_per_month || '120'}
              onChange={(e) => setSettings({ ...settings, target_hours_per_month: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Sinhala Name (ආයතනය):</label>
            <input
              type="text"
              value={settings.org_name_si || ''}
              onChange={(e) => setSettings({ ...settings, org_name_si: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Institute English Name:</label>
            <input
              type="text"
              value={settings.institute_name}
              onChange={(e) => setSettings({ ...settings, institute_name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Centre Sinhala Name (පුහුණු මධ්‍යස්ථානය):</label>
            <input
              type="text"
              value={settings.centre_name_si}
              onChange={(e) => setSettings({ ...settings, centre_name_si: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title (පාඨමාලාවේ නම):</label>
            <input
              type="text"
              value={settings.course_title}
              onChange={(e) => setSettings({ ...settings, course_title: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
