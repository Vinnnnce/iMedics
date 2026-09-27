/* ============================================
   Medic1905 Admin Dashboard — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ── Mock Data ──────────────────────────────
  const mockUsers = [
    { id: 1, name: 'Dr. Sarah Chen', email: 'sarah.chen@medic1905.com', role: 'Doctor', status: 'active', verified: true, joined: '2026-01-15' },
    { id: 2, name: 'John Mitchell', email: 'john.m@gmail.com', role: 'Patient', status: 'active', verified: false, joined: '2026-02-20' },
    { id: 3, name: 'Dr. Ahmed Hassan', email: 'ahmed.h@medic1905.com', role: 'Doctor', status: 'active', verified: true, joined: '2026-01-10' },
    { id: 4, name: 'Lisa Park', email: 'lisa.park@lab.com', role: 'Lab Staff', status: 'active', verified: true, joined: '2026-03-01' },
    { id: 5, name: 'Robert Kim', email: 'rkim@email.com', role: 'Patient', status: 'inactive', verified: false, joined: '2026-03-05' },
    { id: 6, name: 'Dr. Maria Santos', email: 'maria.s@medic1905.com', role: 'Doctor', status: 'active', verified: true, joined: '2026-01-20' },
    { id: 7, name: 'James Wilson', email: 'jwilson@email.com', role: 'Patient', status: 'active', verified: false, joined: '2026-03-10' },
    { id: 8, name: 'Emma Davis', email: 'emma.d@lab.com', role: 'Lab Staff', status: 'pending', verified: false, joined: '2026-03-12' },
    { id: 9, name: 'Admin User', email: 'admin@medic1905.com', role: 'Admin', status: 'active', verified: true, joined: '2026-01-01' },
    { id: 10, name: 'Dr. Kevin Lee', email: 'kevin.lee@medic1905.com', role: 'Doctor', status: 'active', verified: false, joined: '2026-03-15' },
  ];

  const mockConsultations = [
    { id: 'C-2026-001', patient: 'John Mitchell', doctor: 'Dr. Sarah Chen', date: '2026-09-25', status: 'completed' },
    { id: 'C-2026-002', patient: 'Robert Kim', doctor: 'Dr. Ahmed Hassan', date: '2026-09-25', status: 'in-progress' },
    { id: 'C-2026-003', patient: 'James Wilson', doctor: 'Dr. Maria Santos', date: '2026-09-26', status: 'scheduled' },
    { id: 'C-2026-004', patient: 'John Mitchell', doctor: 'Dr. Sarah Chen', date: '2026-09-26', status: 'scheduled' },
    { id: 'C-2026-005', patient: 'Robert Kim', doctor: 'Dr. Kevin Lee', date: '2026-09-27', status: 'cancelled' },
  ];

  const mockLabOrders = [
    { id: 'LAB-001', patient: 'John Mitchell', test: 'Complete Blood Count', status: 'completed', date: '2026-09-24' },
    { id: 'LAB-002', patient: 'Robert Kim', test: 'Lipid Panel', status: 'pending', date: '2026-09-25' },
    { id: 'LAB-003', patient: 'James Wilson', test: 'Thyroid Function', status: 'in-progress', date: '2026-09-26' },
  ];

  const mockServices = [
    { name: 'Authentication (Clerk)', status: 'online', latency: '42ms' },
    { name: 'Database (Neon Postgres)', status: 'online', latency: '18ms' },
    { name: 'File Storage (AWS S3)', status: 'online', latency: '35ms' },
    { name: 'AI Service (Kimi K3)', status: 'degraded', latency: '1.2s' },
    { name: 'Web Application (Next.js)', status: 'online', latency: '120ms' },
    { name: 'Backend API (NestJS)', status: 'online', latency: '28ms' },
  ];

  const mockVerifications = [
    { name: 'Dr. Kevin Lee', type: 'Doctor', specialty: 'Cardiology', submitted: '2026-09-20' },
    { name: 'Emma Davis', type: 'Lab Staff', specialty: 'Hematology', submitted: '2026-09-22' },
    { name: 'Dr. Kevin Lee', type: 'Doctor', specialty: 'Cardiology', submitted: '2026-09-20' },
  ];

  // ── Helper functions ──────────────────────
  function badge(text, type) {
    return '<span class="badge badge-' + type + '">' + text + '</span>';
  }

  function statusBadge(status) {
    const map = {
      'active': ['Active', 'success'],
      'inactive': ['Inactive', 'neutral'],
      'pending': ['Pending', 'warning'],
      'completed': ['Completed', 'success'],
      'in-progress': ['In Progress', 'info'],
      'scheduled': ['Scheduled', 'neutral'],
      'cancelled': ['Cancelled', 'error'],
    };
    const [label, type] = map[status] || [status, 'neutral'];
    return badge(label, type);
  }

  function statusDot(status) {
    return '<span class="status-dot ' + status + '"></span>';
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  // ── Views ─────────────────────────────────
  const views = {

    // ═══ DASHBOARD ═══
    dashboard: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Dashboard Overview</h1>
            <p class="page-subtitle">Monitor key metrics across the Medic1905 platform</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="alert('Exporting CSV...')">Export Report</button>
            <button class="btn btn-primary" onclick="alert('Generating report...')">Generate Report</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
            <div class="kpi-label">Total Users</div>
            <div class="kpi-value">2,847</div>
            <div class="kpi-delta up">↑ 12% vs last month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="kpi-label">Consultations Today</div>
            <div class="kpi-value">142</div>
            <div class="kpi-delta up">↑ 8% vs yesterday</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg></div>
            <div class="kpi-label">Lab Tests This Week</div>
            <div class="kpi-value">386</div>
            <div class="kpi-delta flat">— No change</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4M12 2L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-5z"/></svg></div>
            <div class="kpi-label">Pending Verifications</div>
            <div class="kpi-value">3</div>
            <div class="kpi-delta down">↓ 2 reviewed today</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Weekly Activity</h2>
              <select class="filter-select"><option>Week</option><option>Month</option><option>Quarter</option></select>
            </div>
            <div class="chart-container">
              ${[65, 72, 80, 68, 90, 85, 76].map((h, i) => `
                <div class="chart-bar">
                  <div class="chart-bar-fill" style="height:${h}%"></div>
                  <span class="chart-bar-label">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">System Health</h2>
              ${badge('Operational', 'success')}
            </div>
            <div class="service-list">
              ${mockServices.map(s => `
                <div class="service-item">
                  ${statusDot(s.status)}
                  <span class="service-item-name">${s.name}</span>
                  <span class="service-item-status" style="color:var(--color-${s.status === 'online' ? 'success' : s.status === 'degraded' ? 'warning' : 'error'})">
                    ${s.status === 'online' ? 'Online' : s.status === 'degraded' ? 'Degraded' : 'Down'}
                  </span>
                  <span style="font-size:var(--text-xs);color:var(--color-text-faint)">${s.latency}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Consultations</h2>
            <a href="#/consultations" class="btn btn-ghost">View all →</a>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${mockConsultations.map(c => `
                  <tr>
                    <td><strong>${c.id}</strong></td>
                    <td>${c.patient}</td>
                    <td>${c.doctor}</td>
                    <td>${c.date}</td>
                    <td>${statusBadge(c.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="user-cards-mobile">
            ${mockConsultations.map(c => `
              <div class="user-card-mobile">
                <div class="user-card-mobile-header">
                  <div class="avatar">${initials(c.patient)}</div>
                  <div style="flex:1">
                    <div class="user-card-mobile-name">${c.patient}</div>
                    <div class="user-card-mobile-meta">${c.doctor} · ${c.date}</div>
                  </div>
                  ${statusBadge(c.status)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    // ═══ USERS ═══
    users: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">User Management</h1>
            <p class="page-subtitle">Manage patients, doctors, lab staff, and administrators</p>
          </div>
          <button class="btn btn-primary" onclick="document.getElementById('user-modal').classList.add('active')">+ Add User</button>
        </div>

        <div class="filters">
          <select class="filter-select" id="role-filter">
            <option value="">All Roles</option>
            <option value="Patient">Patients</option>
            <option value="Doctor">Doctors</option>
            <option value="Lab Staff">Lab Staff</option>
            <option value="Admin">Admins</option>
          </select>
          <select class="filter-select">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <select class="filter-select">
            <option value="">Verification: All</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${mockUsers.map(u => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <div class="avatar" style="width:32px;height:32px;font-size:11px">${initials(u.name)}</div>
                        <strong>${u.name}</strong>
                      </div>
                    </td>
                    <td style="color:var(--color-text-muted)">${u.email}</td>
                    <td>${badge(u.role, u.role === 'Doctor' ? 'info' : u.role === 'Patient' ? 'neutral' : u.role === 'Admin' ? 'error' : 'warning')}</td>
                    <td>${statusBadge(u.status)}</td>
                    <td>${u.verified ? badge('Verified', 'success') : badge('Pending', 'warning')}</td>
                    <td style="color:var(--color-text-faint)">${u.joined}</td>
                    <td>
                      <div style="display:flex;gap:4px">
                        <button class="btn btn-ghost" style="min-height:36px;padding:4px 12px" onclick="alert('Viewing ${u.name}')">View</button>
                        <button class="btn btn-ghost" style="min-height:36px;padding:4px 12px" onclick="toggleUserStatus(${u.id})">${u.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="user-cards-mobile">
            ${mockUsers.map(u => `
              <div class="user-card-mobile">
                <div class="user-card-mobile-header">
                  <div class="avatar" style="width:36px;height:36px;font-size:12px">${initials(u.name)}</div>
                  <div style="flex:1">
                    <div class="user-card-mobile-name">${u.name}</div>
                    <div class="user-card-mobile-meta">${u.email}</div>
                  </div>
                  ${statusBadge(u.status)}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  ${badge(u.role, u.role === 'Doctor' ? 'info' : u.role === 'Patient' ? 'neutral' : u.role === 'Admin' ? 'error' : 'warning')}
                  ${u.verified ? badge('Verified', 'success') : badge('Pending', 'warning')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-overlay" id="user-modal">
          <div class="modal">
            <div class="modal-header">
              <span class="modal-title">Add New User</span>
              <button class="modal-close" onclick="document.getElementById('user-modal').classList.remove('active')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input class="form-input" type="text" placeholder="Enter full name">
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input class="form-input" type="email" placeholder="user@medic1905.com">
              </div>
              <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-select">
                  <option>Patient</option>
                  <option>Doctor</option>
                  <option>Lab Staff</option>
                  <option>Admin</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select">
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('user-modal').classList.remove('active')">Cancel</button>
              <button class="btn btn-primary" onclick="document.getElementById('user-modal').classList.remove('active');alert('User created successfully')">Create User</button>
            </div>
          </div>
        </div>
      `;
    },

    // ═══ ROLES & PERMISSIONS ═══
    roles: function () {
      const roles = [
        { name: 'Patient', users: 1842, permissions: ['View own records', 'Book appointments', 'Upload lab results', 'View prescriptions', 'Rate doctors'] },
        { name: 'Doctor', users: 87, permissions: ['View patient records', 'Create consultations', 'Order lab tests', 'Prescribe medication', 'Use AI assistant'] },
        { name: 'Lab Staff', users: 24, permissions: ['View lab orders', 'Enter lab results', 'Upload result files', 'View patient profiles'] },
        { name: 'Admin', users: 5, permissions: ['Full system access', 'Manage users', 'Manage roles', 'View all data', 'System configuration'] },
      ];

      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Roles & Permissions</h1>
            <p class="page-subtitle">Manage user roles and their access levels</p>
          </div>
        </div>

        <div class="grid-2">
          ${roles.map(r => `
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">${r.name}</h2>
                ${badge(r.users + ' users', 'neutral')}
              </div>
              <ul style="list-style:none;padding:0">
                ${r.permissions.map(p => `
                  <li style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:var(--text-sm);color:var(--color-text-muted)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-success)"><path d="M20 6L9 17l-5-5"/></svg>
                    ${p}
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Permission Matrix</h2>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Lab Staff</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>View own profile</td><td>${badge('Yes','success')}</td><td>${badge('Yes','success')}</td><td>${badge('Yes','success')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>View all users</td><td>${badge('No','neutral')}</td><td>${badge('No','neutral')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Create consultations</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Order lab tests</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Enter lab results</td><td>${badge('No','neutral')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Prescribe medication</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Use AI assistant</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
                <tr><td>Manage system settings</td><td>${badge('No','neutral')}</td><td>${badge('No','neutral')}</td><td>${badge('No','neutral')}</td><td>${badge('Yes','success')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // ═══ CONSULTATIONS ═══
    consultations: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Consultations</h1>
            <p class="page-subtitle">Monitor and manage all patient consultations</p>
          </div>
          <div style="display:flex;gap:8px">
            <select class="filter-select"><option>Today</option><option>This Week</option><option>This Month</option></select>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Consultations</div>
            <div class="kpi-value">1,284</div>
            <div class="kpi-delta up">↑ 15% this month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Completed</div>
            <div class="kpi-value">1,102</div>
            <div class="kpi-delta up">↑ 12% completion rate</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Scheduled</div>
            <div class="kpi-value">142</div>
            <div class="kpi-delta flat">— Stable</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Cancelled</div>
            <div class="kpi-value">40</div>
            <div class="kpi-delta down">↓ 3% cancellation rate</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">All Consultations</h2>
            <div class="filters" style="margin:0">
              <select class="filter-select"><option>All Statuses</option><option>Completed</option><option>Scheduled</option><option>In Progress</option><option>Cancelled</option></select>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Consultation ID</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${mockConsultations.map(c => `
                  <tr>
                    <td><strong>${c.id}</strong></td>
                    <td>${c.patient}</td>
                    <td>${c.doctor}</td>
                    <td>${c.date}</td>
                    <td>${statusBadge(c.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="user-cards-mobile">
            ${mockConsultations.map(c => `
              <div class="user-card-mobile">
                <div class="user-card-mobile-header">
                  <div class="avatar" style="width:36px;height:36px;font-size:12px">${initials(c.patient)}</div>
                  <div style="flex:1">
                    <div class="user-card-mobile-name">${c.patient}</div>
                    <div class="user-card-mobile-meta">${c.doctor} · ${c.date}</div>
                  </div>
                  ${statusBadge(c.status)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    // ═══ LAB & DIAGNOSTICS ═══
    labDiagnostics: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Lab & Diagnostics</h1>
            <p class="page-subtitle">Monitor lab test orders, results, and diagnostic imaging</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Lab Orders</div>
            <div class="kpi-value">386</div>
            <div class="kpi-delta up">↑ 8% this week</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Completed Results</div>
            <div class="kpi-value">312</div>
            <div class="kpi-delta up">↑ 81% completion</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pending Tests</div>
            <div class="kpi-value">48</div>
            <div class="kpi-delta flat">— Awaiting processing</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Diagnostic Imaging</div>
            <div class="kpi-value">94</div>
            <div class="kpi-delta up">↑ 5% this week</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Lab Orders</h2>
            <select class="filter-select"><option>All</option><option>Pending</option><option>In Progress</option><option>Completed</option></select>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Order ID</th><th>Patient</th><th>Test</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${mockLabOrders.map(o => `
                  <tr>
                    <td><strong>${o.id}</strong></td>
                    <td>${o.patient}</td>
                    <td>${o.test}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td style="color:var(--color-text-faint)">${o.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="user-cards-mobile">
            ${mockLabOrders.map(o => `
              <div class="user-card-mobile">
                <div class="user-card-mobile-header">
                  <div class="avatar" style="width:36px;height:36px;font-size:12px">${initials(o.patient)}</div>
                  <div style="flex:1">
                    <div class="user-card-mobile-name">${o.patient}</div>
                    <div class="user-card-mobile-meta">${o.test} · ${o.date}</div>
                  </div>
                  ${statusBadge(o.status)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },

    // ═══ VERIFICATION ═══
    verification: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Verification & Compliance</h1>
            <p class="page-subtitle">Review and approve doctor and lab staff verification documents</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Pending Reviews</div>
            <div class="kpi-value">3</div>
            <div class="kpi-delta down">↓ 2 approved today</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Approved This Month</div>
            <div class="kpi-value">28</div>
            <div class="kpi-delta up">↑ 10% vs last month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Rejected This Month</div>
            <div class="kpi-value">4</div>
            <div class="kpi-delta flat">— Review process working</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Verified</div>
            <div class="kpi-value">112</div>
            <div class="kpi-delta up">↑ 5 new badges</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Pending Verification Requests</h2>
          </div>
          ${mockVerifications.map(v => `
            <div class="verification-card">
              <div class="verification-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-5z"/><path d="M9 12l2 2 4-4"/></svg>
              </div>
              <div class="verification-info">
                <div class="verification-name">${v.name}</div>
                <div class="verification-detail">${v.type} · ${v.specialty} · Submitted: ${v.submitted}</div>
              </div>
              <div class="verification-actions">
                <button class="btn btn-secondary" style="min-height:40px" onclick="alert('Reviewing ${v.name}')">Review</button>
                <button class="btn btn-primary" style="min-height:40px" onclick="approveVerification('${v.name}')">Approve</button>
                <button class="btn btn-ghost" style="min-height:40px" onclick="rejectVerification('${v.name}')">Reject</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    },

    // ═══ SYSTEM HEALTH ═══
    systemHealth: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">System Health</h1>
            <p class="page-subtitle">Monitor platform services, errors, and analytics</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Uptime (30 days)</div>
            <div class="kpi-value">99.9%</div>
            <div class="kpi-delta up">↑ Above SLA target</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Sessions</div>
            <div class="kpi-value">342</div>
            <div class="kpi-delta up">↑ Peak usage</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Page Views (24h)</div>
            <div class="kpi-value">8,421</div>
            <div class="kpi-delta up">↑ 15% vs average</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Error Rate</div>
            <div class="kpi-value">0.2%</div>
            <div class="kpi-delta flat">— Within normal range</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Service Status</h2>
            ${badge('Operational', 'success')}
          </div>
          <div class="service-list">
            ${mockServices.map(s => `
              <div class="service-item">
                ${statusDot(s.status)}
                <span class="service-item-name">${s.name}</span>
                <span class="service-item-status" style="color:var(--color-${s.status === 'online' ? 'success' : s.status === 'degraded' ? 'warning' : 'error'})">
                  ${s.status === 'online' ? 'Online' : s.status === 'degraded' ? 'Degraded' : 'Down'}
                </span>
                <span style="font-size:var(--text-xs);color:var(--color-text-faint)">${s.latency}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Error Logs</h2>
            <button class="btn btn-secondary" style="min-height:40px" onclick="alert('Exporting logs...')">Export Logs</button>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Timestamp</th><th>Service</th><th>Level</th><th>Message</th></tr>
              </thead>
              <tbody>
                <tr><td style="color:var(--color-text-faint)">2026-09-27 03:42</td><td>AI Service</td><td>${badge('Warning','warning')}</td><td>Response time exceeded threshold (1.2s)</td></tr>
                <tr><td style="color:var(--color-text-faint)">2026-09-27 02:15</td><td>Database</td><td>${badge('Info','info')}</td><td>Connection pool resized (12 → 16)</td></tr>
                <tr><td style="color:var(--color-text-faint)">2026-09-26 23:08</td><td>Auth</td><td>${badge('Error','error')}</td><td>Failed login attempt rate limited (IP: 192.168.1.x)</td></tr>
                <tr><td style="color:var(--color-text-faint)">2026-09-26 18:30</td><td>Web App</td><td>${badge('Info','info')}</td><td>Deployment completed successfully</td></tr>
                <tr><td style="color:var(--color-text-faint)">2026-09-26 14:22</td><td>Storage</td><td>${badge('Warning','warning')}</td><td>S3 upload retry triggered (attempt 2 of 3)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // ═══ APP DOWNLOADS ═══
    appDownloads: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">App Downloads & Configuration</h1>
            <p class="page-subtitle">Manage download links, track downloads, and update version info</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Windows Downloads</div>
            <div class="kpi-value">12,840</div>
            <div class="kpi-delta up">↑ 8% this month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">iOS Downloads</div>
            <div class="kpi-value">8,921</div>
            <div class="kpi-delta up">↑ 12% this month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Android Downloads</div>
            <div class="kpi-value">15,302</div>
            <div class="kpi-delta up">↑ 15% this month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Downloads</div>
            <div class="kpi-value">37,063</div>
            <div class="kpi-delta up">↑ 12% overall growth</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Platform Configuration</h2>
            <button class="btn btn-primary" style="min-height:40px" onclick="alert('Edit configuration')">+ Update Links</button>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Platform</th><th>Version</th><th>Download URL</th><th>Status</th><th>Last Updated</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Windows</strong></td>
                  <td>v2.1.0</td>
                  <td style="color:var(--color-text-muted)">download.medic1905.com/windows</td>
                  <td>${badge('Active','success')}</td>
                  <td style="color:var(--color-text-faint)">2026-09-15</td>
                </tr>
                <tr>
                  <td><strong>iOS</strong></td>
                  <td>v2.0.4</td>
                  <td style="color:var(--color-text-muted)">apps.apple.com/medic1905</td>
                  <td>${badge('Active','success')}</td>
                  <td style="color:var(--color-text-faint)">2026-09-10</td>
                </tr>
                <tr>
                  <td><strong>Android</strong></td>
                  <td>v2.1.0</td>
                  <td style="color:var(--color-text-muted)">play.google.com/medic1905</td>
                  <td>${badge('Active','success')}</td>
                  <td style="color:var(--color-text-faint)">2026-09-15</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Release Notes</h2>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <strong>v2.1.0</strong>
                ${badge('Latest','success')}
                <span style="font-size:var(--text-xs);color:var(--color-text-faint)">2026-09-15</span>
              </div>
              <ul style="list-style:disc;padding-left:20px;color:var(--color-text-muted);font-size:var(--text-sm)">
                <li>Improved consultation chat performance</li>
                <li>Added dark mode support</li>
                <li>Fixed lab result upload on iOS</li>
                <li>Enhanced AI assistant response accuracy</li>
              </ul>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <strong>v2.0.4</strong>
                <span style="font-size:var(--text-xs);color:var(--color-text-faint)">2026-09-10</span>
              </div>
              <ul style="list-style:disc;padding-left:20px;color:var(--color-text-muted);font-size:var(--text-sm)">
                <li>Fixed appointment scheduling timezone bug</li>
                <li>Improved notification delivery</li>
              </ul>
            </div>
          </div>
        </div>
      `;
    },

    // ═══ SETTINGS ═══
    settings: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Configure platform-wide settings and preferences</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <h2 class="card-title">General Settings</h2>
          </div>
          <div class="form-group">
            <label class="form-label">Platform Name</label>
            <input class="form-input" type="text" value="Medic1905" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Support Email</label>
            <input class="form-input" type="email" value="support@medic1905.com">
          </div>
          <div class="form-group">
            <label class="form-label">Primary Domain</label>
            <input class="form-input" type="text" value="medic1905.com">
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <h2 class="card-title">Feature Toggles</h2>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text)">AI Assistant (Kimi K3)</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-faint)">Enable AI-powered medical history analysis for doctors</div>
              </div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text)">Video Consultations</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-faint)">Enable video chat between doctors and patients</div>
              </div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text)">User Registration</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-faint)">Allow new users to self-register</div>
              </div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text)">Maintenance Mode</div>
                <div style="font-size:var(--color-text-faint);font-size:var(--text-xs)">Temporarily disable user access for maintenance</div>
              </div>
              <label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Download Links Configuration</h2>
          </div>
          <div class="form-group">
            <label class="form-label">Windows App URL</label>
            <input class="form-input" type="url" value="https://download.medic1905.com/windows/Medic1905-Setup.exe">
          </div>
          <div class="form-group">
            <label class="form-label">iOS App Store URL</label>
            <input class="form-input" type="url" value="https://apps.apple.com/app/medic1905/id1234567890">
          </div>
          <div class="form-group">
            <label class="form-label">Android Play Store URL</label>
            <input class="form-input" type="url" value="https://play.google.com/store/apps/details?id=com.medic1905.app">
          </div>
          <button class="btn btn-primary" onclick="alert('Settings saved successfully')">Save Changes</button>
        </div>
      `;
    },

    // ═══ DOWNLOADS PAGE ═══
    downloads: function () {
      return `
        <div class="page-header">
          <div>
            <h1 class="page-title">Download Medic1905</h1>
            <p class="page-subtitle">Get the Medic1905 app for your platform</p>
          </div>
        </div>

        <div class="download-grid">
          <div class="download-card">
            <div class="download-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
            </div>
            <h2 class="download-card-title">Windows</h2>
            <p class="download-card-desc">Download the Medic1905 desktop application for Windows. Full-featured telemedicine access with video consultations, medical records, and AI-assisted diagnostics.</p>
            <div class="download-card-reqs">
              <strong>System Requirements:</strong><br>
              Windows 10 or later · 4GB RAM · 500MB disk space
            </div>
            <button class="btn btn-primary" style="width:100%" onclick="alert('Starting download for Windows...')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download for Windows
            </button>
          </div>

          <div class="download-card">
            <div class="download-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
            </div>
            <h2 class="download-card-title">iOS</h2>
            <p class="download-card-desc">Download the Medic1905 app from the App Store for iPhone and iPad. Access your medical records, book appointments, and consult with doctors on the go.</p>
            <div class="download-card-reqs">
              <strong>System Requirements:</strong><br>
              iOS 14.0 or later · iPhone, iPad, or iPod touch
            </div>
            <button class="btn btn-primary" style="width:100%" onclick="window.open('https://apps.apple.com/app/medic1905/id1234567890', '_blank')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download for iOS
            </button>
          </div>

          <div class="download-card">
            <div class="download-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7l5 5-5 5M14 7l5 5-5 5"/></svg>
            </div>
            <h2 class="download-card-title">Android</h2>
            <p class="download-card-desc">Download the Medic1905 app from the Google Play Store for Android devices. Manage your health, view lab results, and connect with healthcare professionals.</p>
            <div class="download-card-reqs">
              <strong>System Requirements:</strong><br>
              Android 8.0 (Oreo) or later · 100MB storage
            </div>
            <button class="btn btn-primary" style="width:100%" onclick="window.open('https://play.google.com/store/apps/details?id=com.medic1905.app', '_blank')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download for Android
            </button>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-header">
            <h2 class="card-title">Current Version: v2.1.0</h2>
            ${badge('Latest', 'success')}
          </div>
          <ul style="list-style:disc;padding-left:20px;color:var(--color-text-muted);font-size:var(--text-sm);line-height:2">
            <li>Improved consultation chat performance</li>
            <li>Added dark mode support across all platforms</li>
            <li>Fixed lab result upload issue on iOS</li>
            <li>Enhanced AI assistant response accuracy (Kimi K3)</li>
            <li>Improved appointment scheduling with timezone support</li>
          </ul>
        </div>
      `;
    },

    // ═══ LEGAL: PRIVACY POLICY ═══
    legalPrivacy: function () {
      return `
        <div class="legal-content">
          <h1>Privacy Policy — Medic1905</h1>
          <p class="legal-updated">Last updated: September 27, 2026</p>

          <h2>1. Introduction</h2>
          <p>Medic1905 ("Medic1905", "we", "us", "our") operates a telemedicine platform that enables patients, healthcare professionals and laboratory staff to interact and exchange medical information. This Privacy Policy explains how we collect, use, disclose and protect personal data, including health-related information, in connection with the use of our services.</p>

          <h2>2. Categories of Data Collected</h2>
          <p>We may collect the following categories of data:</p>
          <ul>
            <li><strong>Identification data:</strong> name, contact details, account credentials, role (patient, doctor, laboratory staff).</li>
            <li><strong>Medical data:</strong> case files, medical history, consultation notes, diagnostic reports, laboratory results, imaging files and prescriptions.</li>
            <li><strong>Technical data:</strong> IP address, device information, browser type, usage logs and cookies.</li>
            <li><strong>Administrative data:</strong> verification documents for healthcare professionals and laboratory staff.</li>
          </ul>

          <h2>3. Purposes of Processing</h2>
          <p>We process personal data for the following purposes:</p>
          <ul>
            <li>To provide and maintain the telemedicine platform and related services.</li>
            <li>To facilitate consultations, diagnostics, laboratory workflows and appointment management.</li>
            <li>To manage user accounts, roles and permissions.</li>
            <li>To ensure security, prevent fraud and monitor system performance.</li>
            <li>To comply with legal, regulatory and professional obligations.</li>
          </ul>

          <h2>4. Legal Bases for Processing</h2>
          <p>Depending on the jurisdiction and context, we may rely on one or more of the following legal bases:</p>
          <ul>
            <li>Performance of a contract (providing the services you request).</li>
            <li>Compliance with legal obligations.</li>
            <li>Legitimate interests (service improvement, security, fraud prevention).</li>
            <li>Explicit consent for processing certain categories of health data, where required.</li>
          </ul>

          <h2>5. Data Sharing and Recipients</h2>
          <p>We may share personal data with:</p>
          <ul>
            <li>Healthcare professionals and laboratory staff involved in your care, as authorized by you.</li>
            <li>Service providers (hosting, storage, authentication, analytics) bound by contractual confidentiality and data protection obligations.</li>
            <li>Regulatory or law enforcement authorities where required by applicable law.</li>
          </ul>
          <p>We do not sell personal data.</p>

          <h2>6. International Transfers</h2>
          <p>Where personal data is transferred across borders, we implement appropriate safeguards, such as standard contractual clauses or equivalent mechanisms, in accordance with applicable data protection laws.</p>

          <h2>7. Data Retention</h2>
          <p>We retain personal data only for as long as necessary to fulfill the purposes described in this Policy, or as required by law, professional regulations or contractual obligations.</p>

          <h2>8. Your Rights</h2>
          <p>Subject to applicable law, you may have rights to:</p>
          <ul>
            <li>Access your personal data.</li>
            <li>Request rectification of inaccurate data.</li>
            <li>Request erasure or restriction of processing.</li>
            <li>Object to certain processing activities.</li>
            <li>Request data portability.</li>
            <li>Withdraw consent where processing is based on consent.</li>
          </ul>
          <p>Requests may be subject to verification and legal limitations.</p>

          <h2>9. Security Measures</h2>
          <p>We implement technical and organizational measures to protect personal data, including encryption, access controls and audit logging. While no system can be guaranteed to be completely secure, we strive to maintain a high level of security appropriate to the risks.</p>

          <h2>10. Contact</h2>
          <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us using the contact details provided within the Medic1905 platform.</p>
        </div>
      `;
    },

    // ═══ LEGAL: TERMS OF USE ═══
    legalTerms: function () {
      return `
        <div class="legal-content">
          <h1>Terms of Use — Medic1905</h1>
          <p class="legal-updated">Last updated: September 27, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>These Terms of Use ("Terms") govern your access to and use of the Medic1905 platform. By creating an account or using the platform, you acknowledge that you have read, understood and agree to be bound by these Terms.</p>

          <h2>2. Nature of the Service</h2>
          <p>Medic1905 provides a technology platform that connects patients, healthcare professionals and laboratory staff. Medic1905 itself does not practice medicine and does not provide clinical services. Any medical advice, diagnosis or treatment is provided solely by licensed healthcare professionals, not by Medic1905.</p>

          <h2>3. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul>
            <li>Provide accurate and up-to-date information.</li>
            <li>Use the platform in compliance with applicable laws and professional regulations.</li>
            <li>Maintain the confidentiality of your login credentials.</li>
            <li>Refrain from any misuse of the platform, including unauthorized access, data scraping, or uploading unlawful or harmful content.</li>
          </ul>

          <h2>4. Professional Responsibilities</h2>
          <p>Healthcare professionals and laboratory staff remain solely responsible for:</p>
          <ul>
            <li>The accuracy and completeness of their clinical documentation.</li>
            <li>Their diagnostic and treatment decisions.</li>
            <li>Compliance with professional standards and regulatory requirements.</li>
          </ul>

          <h2>5. Limitations of Liability</h2>
          <p>To the maximum extent permitted by law, Medic1905 shall not be liable for any indirect, incidental, consequential or punitive damages arising out of or related to your use of the platform. Where liability cannot be excluded, it shall be limited to the amount you have paid for the use of the platform, if any, during the twelve (12) months preceding the event giving rise to the claim.</p>

          <h2>6. Modifications and Availability</h2>
          <p>We may modify, suspend or discontinue any part of the platform at any time, with or without notice, subject to applicable law. We may also update these Terms from time to time. Continued use of the platform after changes take effect constitutes acceptance of the updated Terms.</p>

          <h2>7. Termination</h2>
          <p>We may suspend or terminate your access to the platform if you violate these Terms, engage in fraudulent or unlawful activity, or pose a security or operational risk. You may terminate your account at any time, subject to applicable data retention obligations.</p>

          <h2>8. Governing Law and Dispute Resolution</h2>
          <p>These Terms shall be governed by the laws specified in the legal section of the platform. Any disputes arising out of or in connection with these Terms shall be submitted to the competent courts of that jurisdiction, unless mandatory law provides otherwise.</p>
        </div>
      `;
    },

    // ═══ LEGAL: COOKIES POLICY ═══
    legalCookies: function () {
      return `
        <div class="legal-content">
          <h1>Cookies Policy — Medic1905</h1>
          <p class="legal-updated">Last updated: September 27, 2026</p>

          <h2>1. What Are Cookies?</h2>
          <p>Cookies are small text files stored on your device when you access the Medic1905 platform. Similar technologies, such as local storage and tracking pixels, may also be used for related purposes.</p>

          <h2>2. Types of Cookies Used</h2>
          <p>We may use the following types of cookies:</p>
          <ul>
            <li><strong>Strictly necessary cookies:</strong> required for core functionality, such as authentication, security and session management.</li>
            <li><strong>Preference cookies:</strong> used to remember your settings, such as language and display preferences.</li>
            <li><strong>Analytics cookies:</strong> used to understand how the platform is used, so we can improve performance and user experience.</li>
          </ul>

          <h2>3. Purposes of Cookies</h2>
          <p>Cookies are used to:</p>
          <ul>
            <li>Keep you signed in securely.</li>
            <li>Provide a consistent and personalized user experience.</li>
            <li>Measure and improve the performance and reliability of the platform.</li>
          </ul>

          <h2>4. Managing Cookies</h2>
          <p>You can manage or disable cookies through your browser or device settings. Please note that disabling certain cookies may affect the functionality or performance of the platform.</p>

          <h2>5. Updates to This Cookies Policy</h2>
          <p>We may update this Cookies Policy from time to time. The most recent version will be made available within the Medic1905 platform, and continued use of the platform after changes take effect constitutes acceptance of the updated Policy.</p>
        </div>
      `;
    },
  };

  // ── Router ─────────────────────────────────
  function router() {
    const hash = window.location.hash.slice(2) || '/dashboard';
    const content = document.getElementById('content');

    // Parse route
    let viewName;
    if (hash === '/dashboard' || hash === '/') {
      viewName = 'dashboard';
    } else if (hash === '/users') {
      viewName = 'users';
    } else if (hash === '/roles') {
      viewName = 'roles';
    } else if (hash === '/consultations') {
      viewName = 'consultations';
    } else if (hash === '/lab-diagnostics') {
      viewName = 'labDiagnostics';
    } else if (hash === '/verification') {
      viewName = 'verification';
    } else if (hash === '/system-health') {
      viewName = 'systemHealth';
    } else if (hash === '/app-downloads') {
      viewName = 'appDownloads';
    } else if (hash === '/settings') {
      viewName = 'settings';
    } else if (hash === '/downloads') {
      viewName = 'downloads';
    } else if (hash === '/legal/privacy') {
      viewName = 'legalPrivacy';
    } else if (hash === '/legal/terms') {
      viewName = 'legalTerms';
    } else if (hash === '/legal/cookies') {
      viewName = 'legalCookies';
    } else {
      viewName = 'dashboard';
    }

    // Render view
    if (views[viewName]) {
      content.innerHTML = views[viewName]();
      content.scrollTop = 0;
    }

    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      const route = item.getAttribute('data-route');
      if (route && hash.includes(route)) {
        item.classList.add('active');
      }
    });

    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.remove('active');
      const route = item.getAttribute('data-route');
      if (route && hash.includes(route)) {
        item.classList.add('active');
      }
    });

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  // ── Global functions for inline handlers ──
  window.toggleUserStatus = function (id) {
    const user = mockUsers.find(u => u.id === id);
    if (user) {
      user.status = user.status === 'active' ? 'inactive' : 'active';
      alert(user.name + ' is now ' + user.status);
      router();
    }
  };

  window.approveVerification = function (name) {
    alert('Verification approved for ' + name);
  };

  window.rejectVerification = function (name) {
    alert('Verification rejected for ' + name);
  };

  // ── Event listeners ────────────────────────
  window.addEventListener('hashchange', router);

  document.getElementById('hamburger').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  });

  document.getElementById('sidebar-overlay').addEventListener('click', function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  });

  document.getElementById('tip-close').addEventListener('click', function () {
    document.getElementById('tip-banner').classList.add('hidden');
  });

  // ── Initialize ────────────────────────────
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  }
  router();
})();
