"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Shield, Ban, CheckCircle, AlertTriangle, Bell,
  Megaphone, Sparkles, TrendingUp, Activity, Search,
  UserPlus, UserCheck, UserX, FileText, BarChart3, Settings,
} from "lucide-react";

type Tab = "overview" | "users" | "notices" | "ads" | "ai";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "banned" | "suspended";
  joined: string;
};

const MOCK_USERS: UserRecord[] = [
  { id: "1", name: "John Doe", email: "john@example.com", role: "PATIENT", status: "active", joined: "2026-09-15" },
  { id: "2", name: "Dr. Sarah Chen", email: "sarah@medic1905.com", role: "DOCTOR", status: "active", joined: "2026-09-10" },
  { id: "3", name: "Mike Lab", email: "mike@lab.com", role: "LAB_SCIENTIST", status: "suspended", joined: "2026-09-12" },
  { id: "4", name: "Jane Smith", email: "jane@example.com", role: "PATIENT", status: "active", joined: "2026-09-20" },
  { id: "5", name: "Dr. James Lee", email: "james@medic1905.com", role: "DOCTOR", status: "banned", joined: "2026-09-05" },
  { id: "6", name: "Emily Davis", email: "emily@example.com", role: "PATIENT", status: "active", joined: "2026-09-22" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<UserRecord[]>(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState([
    { id: "1", text: "System maintenance scheduled for Oct 1, 2:00 AM WAT", date: "Sep 27, 2026", active: true },
    { id: "2", text: "New AI diagnostic tools available for doctors", date: "Sep 25, 2026", active: true },
  ]);
  const [ads, setAds] = useState([
    { id: "1", title: "Health Insurance Plans", content: "Get comprehensive coverage today", placement: "sidebar", active: true },
    { id: "2", title: "Lab Test Discounts", content: "20% off all CBC tests this month", placement: "dashboard", active: false },
  ]);
  const [adTitle, setAdTitle] = useState("");
  const [adContent, setAdContent] = useState("");
  const [adPlacement, setAdPlacement] = useState("sidebar");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin-auth", { method: "POST", body: JSON.stringify({ check: true }) })
      .then((r) => r.json())
      .then((data) => { if (!data.success) router.push("/admin"); })
      .catch(() => {});
  }, [router]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const updateUserStatus = (id: string, status: UserRecord["status"]) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, status } : u)));
  };

  const assignRole = (id: string, role: string) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, role } : u)));
  };

  const postNotice = () => {
    if (!noticeText.trim()) return;
    setNotices([{ id: Date.now().toString(), text: noticeText, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), active: true }, ...notices]);
    setNoticeText("");
  };

  const toggleNotice = (id: string) => {
    setNotices(notices.map((n) => (n.id === id ? { ...n, active: !n.active } : n)));
  };

  const publishAd = () => {
    if (!adTitle.trim() || !adContent.trim()) return;
    setAds([{ id: Date.now().toString(), title: adTitle, content: adContent, placement: adPlacement, active: true }, ...ads]);
    setAdTitle("");
    setAdContent("");
  };

  const toggleAd = (id: string) => {
    setAds(ads.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  };

  const runAIQuery = () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    setTimeout(() => {
      setAiResponse(`Based on the platform data analysis:\n\n• Total registered users: ${users.length}\n• Active users: ${users.filter(u => u.status === "active").length}\n• Suspended users: ${users.filter(u => u.status === "suspended").length}\n• Banned users: ${users.filter(u => u.status === "banned").length}\n• Doctors: ${users.filter(u => u.role === "DOCTOR").length}\n• Patients: ${users.filter(u => u.role === "PATIENT").length}\n• Lab staff: ${users.filter(u => u.role === "LAB_SCIENTIST").length}\n\nRecommendation: The platform shows healthy growth. Consider sending a notice to all active users about new features. The suspended user "Mike Lab" may need follow-up.`);
      setAiLoading(false);
    }, 1500);
  };

  const stats = [
    { label: "Total Users", value: users.length, icon: Users, trend: "+12%" },
    { label: "Active", value: users.filter(u => u.status === "active").length, icon: CheckCircle, trend: "+8%" },
    { label: "Suspended", value: users.filter(u => u.status === "suspended").length, icon: AlertTriangle, trend: "0%" },
    { label: "Banned", value: users.filter(u => u.status === "banned").length, icon: Ban, trend: "0%" },
  ];

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
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="icon-badge h-9 w-9 bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> {stat.trend}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
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

          {/* Recent Activity */}
          <div className="stat-card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </h3>
            <div className="space-y-2">
              {[
                { user: "Dr. Sarah Chen", action: "Updated patient records", time: "2 min ago" },
                { user: "John Doe", action: "Booked appointment", time: "15 min ago" },
                { user: "Mike Lab", action: "Uploaded lab results", time: "1 hour ago" },
                { user: "Jane Smith", action: "Registered as patient", time: "2 hours ago" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="icon-badge h-8 w-8 bg-muted">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
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
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="all">All Roles</option>
              <option value="PATIENT">Patients</option>
              <option value="DOCTOR">Doctors</option>
              <option value="LAB_SCIENTIST">Lab Staff</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
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
                            {user.name[0]}
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
                          onChange={(e) => assignRole(user.id, e.target.value)}
                          className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
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
                          user.status === "suspended" ? "bg-muted text-muted-foreground" :
                          "bg-muted text-destructive"
                        }`}>
                          {user.status === "active" && <CheckCircle className="h-3 w-3" />}
                          {user.status === "suspended" && <AlertTriangle className="h-3 w-3" />}
                          {user.status === "banned" && <Ban className="h-3 w-3" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="text-xs text-muted-foreground">{user.joined}</td>
                      <td>
                        <div className="flex gap-1">
                          {user.status !== "suspended" && (
                            <button
                              onClick={() => updateUserStatus(user.id, "suspended")}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                              title="Suspend"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          {user.status !== "banned" && (
                            <button
                              onClick={() => updateUserStatus(user.id, "banned")}
                              className="p-1.5 rounded hover:bg-accent text-destructive"
                              title="Ban"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {user.status !== "active" && (
                            <button
                              onClick={() => updateUserStatus(user.id, "active")}
                              className="p-1.5 rounded hover:bg-accent text-foreground"
                              title="Restore"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
            />
            <button
              onClick={postNotice}
              className="mt-3 pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2"
            >
              <Megaphone className="h-4 w-4" /> Publish Notice
            </button>
          </div>

          <div className="space-y-2">
            {notices.map((notice) => (
              <div key={notice.id} className="stat-card p-4 flex items-center gap-3">
                <div className="icon-badge h-9 w-9 bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notice.text}</p>
                  <p className="text-xs text-muted-foreground">{notice.date}</p>
                </div>
                <button
                  onClick={() => toggleNotice(notice.id)}
                  className={`status-badge ${notice.active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {notice.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
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
              />
              <textarea
                value={adContent}
                onChange={(e) => setAdContent(e.target.value)}
                placeholder="Ad content..."
                rows={2}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground resize-none"
              />
              <select
                value={adPlacement}
                onChange={(e) => setAdPlacement(e.target.value)}
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="sidebar">Sidebar</option>
                <option value="dashboard">Dashboard Banner</option>
                <option value="login">Login Page</option>
              </select>
              <button
                onClick={publishAd}
                className="pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2"
              >
                <Megaphone className="h-4 w-4" /> Publish Ad
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {ads.map((ad) => (
              <div key={ad.id} className="stat-card p-4 flex items-center gap-3">
                <div className="icon-badge h-9 w-9 bg-muted">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ad.title}</p>
                  <p className="text-xs text-muted-foreground">{ad.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">Placement: {ad.placement}</p>
                </div>
                <button
                  onClick={() => toggleAd(ad.id)}
                  className={`status-badge ${ad.active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {ad.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="ai-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold">AI-Powered Platform Analytics</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ask the AI about platform metrics, user behavior, or get recommendations.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAIQuery()}
                placeholder="Ask about platform analytics, user trends, or recommendations..."
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground outline-none focus:border-foreground"
              />
              <button
                onClick={runAIQuery}
                disabled={aiLoading}
                className="pill-btn bg-foreground text-background px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
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
              { label: "Appointments Today", value: "12", icon: Calendar },
              { label: "Lab Results", value: "8", icon: FileText },
              { label: "Active Cases", value: "24", icon: Activity },
              { label: "Messages", value: "6", icon: Megaphone },
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

import { Calendar } from "lucide-react";
