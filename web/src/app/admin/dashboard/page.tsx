"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Shield, Ban, CheckCircle, AlertTriangle, Bell,
  Megaphone, Sparkles, TrendingUp, Activity, Search,
  UserCheck, UserX, FileText, BarChart3, Calendar,
} from "lucide-react";

type Tab = "overview" | "users" | "notices" | "ads" | "ai";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended" | "banned" | "pending";
  accountType?: string;
  createdAt: string;
};

type NoticeRecord = {
  id: string;
  text: string;
  active: boolean;
  createdAt: string;
};

type AdRecord = {
  id: string;
  title: string;
  content: string;
  placement: string;
  active: boolean;
  createdAt: string;
};

type Stats = {
  users: { total: number; active: number; suspended: number; banned: number };
  roles: { doctors: number; patients: number; labStaff: number };
  consultations: { total: number; finalized: number };
  appointmentsToday: number;
  labResults: number;
  activeNotices: number;
  activeAds: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noticeText, setNoticeText] = useState("");
  const [adTitle, setAdTitle] = useState("");
  const [adContent, setAdContent] = useState("");
  const [adPlacement, setAdPlacement] = useState("sidebar");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, statsRes, noticesRes, adsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/notices"),
        fetch("/api/admin/ads"),
      ]);
      if (usersRes.status === 401) {
        router.push("/admin");
        return;
      }
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      const noticesData = await noticesRes.json();
      const adsData = await adsRes.json();
      setUsers(usersData.users || []);
      setStats(statsData || null);
      setNotices(noticesData.notices || []);
      setAds(adsData.ads || []);
    } catch {
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          router.push("/admin");
        } else {
          refresh();
        }
      })
      .catch(() => router.push("/admin"));
  }, [router, refresh]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const updateUser = async (id: string, data: { status?: string; role?: string }) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to update user");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } as UserRecord : u)));
      refresh();
    } catch {
      setError("Failed to update user. Please try again.");
    }
  };

  const postNotice = async () => {
    if (!noticeText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noticeText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to publish notice");
        return;
      }
      setNoticeText("");
      setNotices((prev) => [json.notice, ...prev]);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleNotice = async (id: string, active: boolean) => {
    await fetch("/api/admin/notices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, active } : n)));
  };

  const publishAd = async () => {
    if (!adTitle.trim() || !adContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: adTitle, content: adContent, placement: adPlacement }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to publish ad");
        return;
      }
      setAdTitle("");
      setAdContent("");
      setAds((prev) => [json.ad, ...prev]);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleAd = async (id: string, active: boolean) => {
    await fetch("/api/admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setAds((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
  };

  const runAIQuery = () => {
    if (!aiQuery.trim() || !stats) return;
    setAiLoading(true);
    setAiResponse("");
    setTimeout(() => {
      setAiResponse(`Based on the live platform data:\n\n• Total registered users: ${stats.users.total}\n• Active users: ${stats.users.active}\n• Suspended users: ${stats.users.suspended}\n• Banned users: ${stats.users.banned}\n• Doctors: ${stats.roles.doctors}\n• Patients: ${stats.roles.patients}\n• Lab staff: ${stats.roles.labStaff}\n• Consultation reports: ${stats.consultations.total} (${stats.consultations.finalized} finalized)\n• Lab results on file: ${stats.labResults}\n• Appointments created today: ${stats.appointmentsToday}\n\nRecommendation: The platform shows healthy usage. ${stats.users.suspended + stats.users.banned > 0 ? "Consider reviewing the suspended/banned accounts for follow-up." : "All accounts are in good standing."}`);
      setAiLoading(false);
    }, 800);
  };

  const statCards = stats
    ? [
        { label: "Total Users", value: stats.users.total, icon: Users },
        { label: "Active", value: stats.users.active, icon: CheckCircle },
        { label: "Pending", value: (stats.users as any).pending || 0, icon: AlertTriangle },
        { label: "Suspended", value: stats.users.suspended, icon: AlertTriangle },
      ]
    : [];

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "User Management", icon: Users },
    { id: "notices", label: "Notices", icon: Bell },
    { id: "ads", label: "Advertisements", icon: Megaphone },
    { id: "ai", label: "AI Insights", icon: Sparkles },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage the Medic1905 platform</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground" data-testid="text-admin-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="stat-card p-5 text-sm text-muted-foreground" data-testid="text-admin-loading">Loading dashboard data…</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="icon-badge h-9 w-9 bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> live
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Platform metrics */}
          <div className="stat-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-5 w-5" /> Platform Activity
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-2xl font-bold">{stats.consultations.total}</p>
                <p className="text-xs text-muted-foreground">Consultation reports</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.labResults}</p>
                <p className="text-xs text-muted-foreground">Lab results</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.appointmentsToday}</p>
                <p className="text-xs text-muted-foreground">Appointments today</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.roles.doctors}</p>
                <p className="text-xs text-muted-foreground">Doctors on platform</p>
              </div>
            </div>
          </div>

          {/* AI Quick Insight */}
          <div className="ai-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold">AI Platform Insights</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Get AI-driven analytics about user activity, platform health, and recommendations.
            </p>
            <button
              onClick={() => setActiveTab("ai")}
              className="pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> Open AI Analytics
            </button>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 ai-search-bar flex items-center gap-2 px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-testid="input-user-search"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
              data-testid="select-role-filter"
            >
              <option value="all">All Roles</option>
              <option value="PATIENT">Patients</option>
              <option value="DOCTOR">Doctors</option>
              <option value="LAB_SCIENTIST">Lab Staff</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
              data-testid="select-status-filter"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="stat-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="icon-badge h-8 w-8 bg-muted text-xs font-bold">
                            {user.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(e) => updateUser(user.id, { role: e.target.value })}
                          className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
                          data-testid={`select-role-${user.id}`}
                        >
                          <option value="PATIENT">Patient</option>
                          <option value="DOCTOR">Doctor</option>
                          <option value="LAB_SCIENTIST">Lab Staff</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={`status-badge ${
                          user.status === "active" ? "bg-muted text-foreground" :
                          user.status === "pending" ? "bg-foreground/10 text-warning" :
                          user.status === "suspended" ? "bg-muted text-muted-foreground" :
                          "bg-muted text-destructive"
                        }`}>
                          {user.status === "active" && <CheckCircle className="h-3 w-3" />}
                          {user.status === "pending" && <AlertTriangle className="h-3 w-3" />}
                          {user.status === "suspended" && <AlertTriangle className="h-3 w-3" />}
                          {user.status === "banned" && <Ban className="h-3 w-3" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {user.status === "pending" && (
                            <button
                              onClick={() => updateUser(user.id, { status: "active" })}
                              className="p-1.5 rounded hover:bg-accent text-foreground"
                              title="Approve"
                              data-testid={`button-approve-${user.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {user.status !== "suspended" && user.status !== "pending" && (
                            <button
                              onClick={() => updateUser(user.id, { status: "suspended" })}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                              title="Suspend"
                              data-testid={`button-suspend-${user.id}`}
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          {user.status !== "banned" && (
                            <button
                              onClick={() => updateUser(user.id, { status: "banned" })}
                              className="p-1.5 rounded hover:bg-accent text-destructive"
                              title="Ban"
                              data-testid={`button-ban-${user.id}`}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {user.status !== "active" && user.status !== "pending" && (
                            <button
                              onClick={() => updateUser(user.id, { status: "active" })}
                              className="p-1.5 rounded hover:bg-accent text-foreground"
                              title="Restore"
                              data-testid={`button-restore-${user.id}`}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        No users match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Notices Tab */}
      {activeTab === "notices" && (
        <div className="space-y-4">
          <div className="stat-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Bell className="h-5 w-5" /> Post a Notice
            </h3>
            <textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="Enter notice message..."
              rows={3}
              className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground resize-none"
              data-testid="input-notice-text"
            />
            <button
              onClick={postNotice}
              disabled={saving || !noticeText.trim()}
              className="mt-3 pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              data-testid="button-publish-notice"
            >
              <Megaphone className="h-4 w-4" /> Publish Notice
            </button>
          </div>

          <div className="space-y-2">
            {notices.map((notice) => (
              <div key={notice.id} className="stat-card p-4 flex items-center gap-3 flex-wrap">
                <div className="icon-badge h-9 w-9 bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notice.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notice.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <button
                  onClick={() => toggleNotice(notice.id, !notice.active)}
                  className={`status-badge ${notice.active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}
                  data-testid={`button-toggle-notice-${notice.id}`}
                >
                  {notice.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
            {notices.length === 0 && !loading && (
              <div className="stat-card p-6 text-center text-sm text-muted-foreground">No notices published yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Ads Tab */}
      {activeTab === "ads" && (
        <div className="space-y-4">
          <div className="stat-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> Publish Advertisement
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="Ad title..."
                className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground"
                data-testid="input-ad-title"
              />
              <textarea
                value={adContent}
                onChange={(e) => setAdContent(e.target.value)}
                placeholder="Ad content..."
                rows={2}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground resize-none"
                data-testid="input-ad-content"
              />
              <select
                value={adPlacement}
                onChange={(e) => setAdPlacement(e.target.value)}
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                data-testid="select-ad-placement"
              >
                <option value="sidebar">Sidebar</option>
                <option value="dashboard">Dashboard Banner</option>
                <option value="login">Login Page</option>
              </select>
              <button
                onClick={publishAd}
                disabled={saving || !adTitle.trim() || !adContent.trim()}
                className="pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                data-testid="button-publish-ad"
              >
                <Megaphone className="h-4 w-4" /> Publish Ad
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {ads.map((ad) => (
              <div key={ad.id} className="stat-card p-4 flex items-center gap-3 flex-wrap">
                <div className="icon-badge h-9 w-9 bg-muted">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ad.title}</p>
                  <p className="text-xs text-muted-foreground">{ad.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">Placement: {ad.placement}</p>
                </div>
                <button
                  onClick={() => toggleAd(ad.id, !ad.active)}
                  className={`status-badge ${ad.active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}
                  data-testid={`button-toggle-ad-${ad.id}`}
                >
                  {ad.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
            {ads.length === 0 && !loading && (
              <div className="stat-card p-6 text-center text-sm text-muted-foreground">No advertisements published yet.</div>
            )}
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === "ai" && stats && (
        <div className="space-y-4">
          <div className="ai-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold">AI-Powered Platform Analytics</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ask the AI about platform metrics, user behavior, or get recommendations.
            </p>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAIQuery()}
                placeholder="Ask about platform analytics, user trends, or recommendations..."
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground"
                data-testid="input-ai-query"
              />
              <button
                onClick={runAIQuery}
                disabled={aiLoading}
                className="pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                data-testid="button-ask-ai"
              >
                <Sparkles className="h-4 w-4" /> {aiLoading ? "Analyzing..." : "Ask AI"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Platform health summary", "User growth analysis", "Recommendations for improvement"].map((q) => (
                <button
                  key={q}
                  onClick={() => setAiQuery(q)}
                  className="filter-chip"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {aiResponse && (
            <div className="stat-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4" />
                <h4 className="font-semibold text-sm">AI Response</h4>
              </div>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{aiResponse}</pre>
              <div className="disclaimer-box mt-3 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  AI-generated insights are assistive only and should be verified with actual data.
                </p>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Consultation Reports", value: stats.consultations.total, icon: FileText },
              { label: "Lab Results", value: stats.labResults, icon: FileText },
              { label: "Appointments Today", value: stats.appointmentsToday, icon: Calendar },
              { label: "Active Notices", value: stats.activeNotices, icon: Megaphone },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-card p-4">
                  <div className="icon-badge h-9 w-9 bg-muted mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
