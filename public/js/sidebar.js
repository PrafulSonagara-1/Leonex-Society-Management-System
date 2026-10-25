/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LEONEX SMART SOCIETY MANAGEMENT SYSTEM — SIDEBAR CONTROLLER
 * Supports: Expanded/Collapsed states, Hover Tooltips, Role Filtering,
 * Edge Toggle Pill, Tab Automation, and Theme Synchronization.
 * ══════════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'leonex_sidebar_collapsed';

  // ══════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  // 21ST.DEV OUTLINED ANIMATED VECTOR ICONS
  // Pure stroke-based outlined icons with micro-animations on hover (no zoom/scale)
  // ══════════════════════════════════════════════════════════════════════════════
  const LEONEX_OUTLINE_ICONS = {
    'dashboard': `<svg class="lx-anim-icon lx-icon-dashboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="lx-draw-main" pathLength="100" width="7" height="9" x="3" y="3" rx="1.5"/><rect class="lx-draw-sub" pathLength="100" width="7" height="5" x="14" y="3" rx="1.5"/><rect class="lx-draw-sub" pathLength="100" width="7" height="9" x="14" y="12" rx="1.5"/><rect class="lx-draw-main" pathLength="100" width="7" height="5" x="3" y="16" rx="1.5"/></svg>`,
    'residents': `<svg class="lx-anim-icon lx-icon-residents" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="lx-draw-main" pathLength="100" cx="9" cy="7" r="4"/><path class="lx-draw-main" pathLength="100" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path class="lx-draw-sub" pathLength="100" d="M16 3.13a4 4 0 0 1 0 7.75"/><path class="lx-draw-sub" pathLength="100" d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>`,
    'towers': `<svg class="lx-anim-icon lx-icon-towers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path class="lx-draw-main" pathLength="100" d="M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2"/><line class="lx-draw-sub" pathLength="100" x1="10" y1="6" x2="14" y2="6"/><line class="lx-draw-sub" pathLength="100" x1="10" y1="10" x2="14" y2="10"/><line class="lx-draw-sub" pathLength="100" x1="10" y1="14" x2="14" y2="14"/><line class="lx-draw-sub" pathLength="100" x1="10" y1="18" x2="14" y2="18"/></svg>`,
    'family': `<svg class="lx-anim-icon lx-icon-family" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="lx-draw-sub" pathLength="100" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/></svg>`,
    'complaints': `<svg class="lx-anim-icon lx-icon-complaints" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path class="lx-draw-sub" pathLength="100" d="M12 18v2a2 2 0 0 1-2 2"/></svg>`,
    'visitors': `<svg class="lx-anim-icon lx-icon-visitors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path class="lx-draw-sub" pathLength="100" d="m9 12 2 2 4-4"/></svg>`,
    'guard-entry': `<svg class="lx-anim-icon lx-icon-guard-entry" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="lx-draw-main" pathLength="100" width="18" height="14" x="3" y="5" rx="2"/><circle class="lx-draw-sub" pathLength="100" cx="9" cy="11" r="2"/><line class="lx-draw-sub" pathLength="100" x1="15" y1="9" x2="17" y2="9"/><line class="lx-draw-sub" pathLength="100" x1="15" y1="13" x2="17" y2="13"/><path class="lx-draw-main" pathLength="100" d="M6 17c0-1.5 1.5-2 3-2s3 .5 3 2"/></svg>`,
    'guard-pending': `<svg class="lx-anim-icon lx-icon-guard-pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M5 22h14M5 2h14"/><path class="lx-draw-sub" pathLength="100" d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
    'guard-deliveries': `<svg class="lx-anim-icon lx-icon-deliveries" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path class="lx-draw-sub" pathLength="100" d="M12 22V12"/><path class="lx-draw-sub" pathLength="100" d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/></svg>`,
    'vehicles': `<svg class="lx-anim-icon lx-icon-vehicles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle class="lx-draw-sub" pathLength="100" cx="7" cy="17" r="2"/><circle class="lx-draw-sub" pathLength="100" cx="17" cy="17" r="2"/><line class="lx-draw-main" pathLength="100" x1="9" y1="17" x2="15" y2="17"/></svg>`,
    'emergency': `<svg class="lx-anim-icon lx-icon-emergency" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line class="lx-draw-sub" pathLength="100" x1="12" y1="9" x2="12" y2="13"/><line class="lx-draw-sub" pathLength="100" x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'finance': `<svg class="lx-anim-icon lx-icon-finance" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path class="lx-draw-sub" pathLength="100" d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line class="lx-draw-sub" pathLength="100" x1="12" y1="6.5" x2="12" y2="17.5"/></svg>`,
    'amenities': `<svg class="lx-anim-icon lx-icon-amenities" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="lx-draw-main" pathLength="100" width="18" height="18" x="3" y="4" rx="2"/><line class="lx-draw-sub" pathLength="100" x1="16" y1="2" x2="16" y2="6"/><line class="lx-draw-sub" pathLength="100" x1="8" y1="2" x2="8" y2="6"/><line class="lx-draw-sub" pathLength="100" x1="3" y1="10" x2="21" y2="10"/><path class="lx-draw-main" pathLength="100" d="m9 16 2 2 4-4"/></svg>`,
    'notices': `<svg class="lx-anim-icon lx-icon-notices" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path class="lx-draw-sub" pathLength="100" d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    'polls': `<svg class="lx-anim-icon lx-icon-polls" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line class="lx-draw-main" pathLength="100" x1="2" y1="20" x2="22" y2="20"/><rect class="lx-draw-sub" pathLength="100" x="4" y="13" width="4" height="7" rx="1"/><rect class="lx-draw-sub" pathLength="100" x="10" y="8" width="4" height="12" rx="1"/><rect class="lx-draw-sub" pathLength="100" x="16" y="3" width="4" height="17" rx="1"/></svg>`,
    'documents': `<svg class="lx-anim-icon lx-icon-documents" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M4 4h4.5a2 2 0 0 1 1.6.8L11.5 6H19a2 2 0 0 1 2 2v2H4V4z"/><line class="lx-draw-sub" pathLength="100" x1="7" y1="8" x2="17" y2="8"/><path class="lx-draw-sub" pathLength="100" d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V8"/></svg>`,
    'reports': `<svg class="lx-anim-icon lx-icon-reports" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path class="lx-draw-sub" pathLength="100" d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
    'audit': `<svg class="lx-anim-icon lx-icon-audit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path class="lx-draw-sub" pathLength="100" d="M3 3v5h5"/><line class="lx-draw-sub" pathLength="100" x1="12" y1="7" x2="12" y2="12"/><line class="lx-draw-sub" pathLength="100" x1="12" y1="12" x2="16" y2="14"/></svg>`,
    'roles': `<svg class="lx-anim-icon lx-icon-roles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle class="lx-draw-sub" pathLength="100" cx="16.5" cy="7.5" r=".5"/></svg>`,
    'profile': `<svg class="lx-anim-icon lx-icon-profile" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="lx-draw-main" pathLength="100" cx="12" cy="8" r="4"/><path class="lx-draw-sub" pathLength="100" d="M20 21a8 8 0 1 0-16 0"/></svg>`,
    'contacts': `<svg class="lx-anim-icon lx-icon-contacts" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line class="lx-draw-sub" pathLength="100" x1="8" y1="9" x2="16" y2="9"/><line class="lx-draw-sub" pathLength="100" x1="8" y1="13" x2="13" y2="13"/></svg>`,
    'subscribers': `<svg class="lx-anim-icon lx-icon-subscribers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="lx-draw-main" pathLength="100" width="20" height="16" x="2" y="4" rx="2"/><path class="lx-draw-sub" pathLength="100" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    'logout': `<svg class="lx-anim-icon lx-icon-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="lx-draw-main" pathLength="100" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline class="lx-draw-sub" pathLength="100" points="16 17 21 12 16 7"/><line class="lx-draw-sub" pathLength="100" x1="21" y1="12" x2="9" y2="12"/></svg>`
  };

  function getIconHtml(iconKey) {
    const icon = LEONEX_OUTLINE_ICONS[iconKey];
    if (icon) {
      return `<span class="lx-icon-layer lx-icon-animated">${icon}</span>`;
    }
    if (iconKey && iconKey.trim().startsWith('<svg')) {
      return iconKey;
    }
    return `<i class="${iconKey || 'fa-solid fa-circle'}"></i>`;
  }

  // Navigation schema for all SSMS roles
  const LEONEX_NAV_CONFIG = [
    {
      section: 'LEONEX',
      roles: ['Super Admin', 'SUPER_ADMIN'],
      items: [
        {
          id: 'nav-sa-overview',
          label: 'Dashboard',
          icon: 'dashboard',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-overview-btn', 'super-admin': 'tab-sa-overview-btn' },
          defaultUrl: 'super-admin'
        },
        {
          id: 'nav-sa-societies',
          label: 'Societies',
          icon: 'towers',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-societies-btn', 'super-admin': 'tab-sa-societies-btn' },
          defaultUrl: 'super-admin#tab-sa-societies',
          submenu: [
            {
              id: 'sub-sa-soc-all',
              label: 'All Societies',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-societies-btn', 'super-admin': 'tab-sa-societies-btn' },
              url: "javascript:if(window.switchSocietyTab)window.switchSocietyTab('ALL')"
            },
            {
              id: 'sub-sa-soc-active',
              label: 'Active',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-societies-btn', 'super-admin': 'tab-sa-societies-btn' },
              url: "javascript:if(window.switchSocietyTab)window.switchSocietyTab('ACTIVE')"
            },
            {
              id: 'sub-sa-soc-inactive',
              label: 'Inactive',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-societies-btn', 'super-admin': 'tab-sa-societies-btn' },
              url: "javascript:if(window.switchSocietyTab)window.switchSocietyTab('INACTIVE')"
            },
            {
              id: 'sub-sa-soc-suspended',
              label: 'Suspended',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-societies-btn', 'super-admin': 'tab-sa-societies-btn' },
              url: "javascript:if(window.switchSocietyTab)window.switchSocietyTab('SUSPENDED')"
            }
          ]
        },
        {
          id: 'nav-sa-users',
          label: 'Users',
          icon: 'residents',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
          defaultUrl: 'super-admin#tab-sa-users',
          submenu: [
            {
              id: 'sub-sa-usr-all',
              label: 'All Users',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
              url: "javascript:if(window.switchUserTab)window.switchUserTab('ALL')"
            },
            {
              id: 'sub-sa-usr-residents',
              label: 'Residents',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
              url: "javascript:if(window.switchUserTab)window.switchUserTab('RESIDENT')"
            },
            {
              id: 'sub-sa-usr-secretaries',
              label: 'Secretaries',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
              url: "javascript:if(window.switchUserTab)window.switchUserTab('SECRETARY')"
            },
            {
              id: 'sub-sa-usr-guards',
              label: 'Guards',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
              url: "javascript:if(window.switchUserTab)window.switchUserTab('GUARD')"
            },
            {
              id: 'sub-sa-usr-committee',
              label: 'Committee',
              roles: ['Super Admin', 'SUPER_ADMIN'],
              targetTab: { 'super-admin.html': 'tab-sa-users-btn', 'super-admin': 'tab-sa-users-btn' },
              url: "javascript:if(window.switchUserTab)window.switchUserTab('COMMITTEE')"
            }
          ]
        },
        {
          id: 'nav-sa-contacts',
          label: 'Contact Inquiries',
          icon: 'contacts',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-contacts-btn', 'super-admin': 'tab-sa-contacts-btn' },
          defaultUrl: 'super-admin#tab-sa-contacts'
        },
        {
          id: 'nav-sa-subscribers',
          label: 'Subscribers',
          icon: 'subscribers',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-subscribers-btn', 'super-admin': 'tab-sa-subscribers-btn' },
          defaultUrl: 'super-admin#tab-sa-subscribers'
        },
        {
          id: 'nav-sa-logs',
          label: 'Login Activity',
          icon: 'audit',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-logs-btn', 'super-admin': 'tab-sa-logs-btn' },
          defaultUrl: 'super-admin#tab-sa-logs'
        },
        {
          id: 'nav-sa-activity',
          label: 'System Activity',
          icon: 'reports',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-activity-btn', 'super-admin': 'tab-sa-activity-btn' },
          defaultUrl: 'super-admin#tab-sa-activity'
        },
        {
          id: 'nav-sa-settings',
          label: 'Settings',
          icon: 'roles',
          roles: ['Super Admin', 'SUPER_ADMIN'],
          targetTab: { 'super-admin.html': 'tab-sa-settings-btn', 'super-admin': 'tab-sa-settings-btn' },
          defaultUrl: 'super-admin#tab-sa-settings'
        }
      ]
    },
    {
      section: 'Overview',
      roles: ['Admin', 'Resident', 'Security Guard', 'Committee Member'],
      items: [
        {
          id: 'nav-dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          roles: ['Admin', 'Resident', 'Security Guard', 'Committee Member'],
          targetTab: {
            'admin.html': 'tab-dashboard-btn',
            'resident.html': 'tab-res-home-btn',
            'guard.html': 'entry',
            'committee.html': 'tab-overview'
          },
          defaultUrl: {
            'Admin': 'admin.html',
            'Resident': 'resident.html',
            'Security Guard': 'guard.html',
            'Committee Member': 'committee.html'
          }
        }
      ]
    },
    {
      section: 'Society & Residents',
      roles: ['Admin', 'Resident', 'Committee Member'],
      items: [
        {
          id: 'nav-residents',
          label: 'Residents Directory',
          icon: 'residents',
          roles: ['Admin', 'Committee Member'],
          targetTab: { 'admin.html': 'tab-residents-btn' },
          defaultUrl: 'admin.html#tab-residents'
        },
        {
          id: 'nav-towers',
          label: 'Towers & Flats',
          icon: 'towers',
          roles: ['Admin'],
          targetTab: { 'admin.html': 'tab-towers-btn' },
          defaultUrl: 'admin.html#tab-towers'
        },
        {
          id: 'nav-family',
          label: 'Family & Tenancy',
          icon: 'family',
          roles: ['Resident'],
          targetTab: { 'resident.html': 'tab-res-family-btn' },
          defaultUrl: 'resident.html#tab-res-family'
        },
        {
          id: 'nav-complaints',
          label: 'Helpdesk & Complaints',
          icon: 'complaints',
          roles: ['Admin', 'Resident', 'Committee Member'],
          targetTab: {
            'admin.html': 'tab-complaints-btn',
            'resident.html': 'tab-res-complaints-btn',
            'committee.html': 'tab-complaints'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-complaints',
            'Resident': 'resident.html#tab-res-complaints',
            'Committee Member': 'committee.html#tab-complaints'
          }
        }
      ]
    },
    {
      section: 'Security & Access',
      roles: ['Admin', 'Resident', 'Security Guard'],
      items: [
        {
          id: 'nav-visitors',
          label: 'Gate & Visitors',
          icon: 'visitors',
          roles: ['Admin', 'Resident'],
          targetTab: {
            'admin.html': 'tab-visitors-btn',
            'resident.html': 'tab-res-visitors-btn'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-visitors',
            'Resident': 'resident.html#tab-res-visitors'
          }
        },
        {
          id: 'nav-guard-entry',
          label: 'Entry Desk',
          icon: 'guard-entry',
          roles: ['Security Guard'],
          targetTab: { 'guard.html': 'entry' },
          defaultUrl: 'guard.html'
        },
        {
          id: 'nav-guard-pending',
          label: 'Pending Approvals',
          icon: 'guard-pending',
          roles: ['Security Guard'],
          targetTab: { 'guard.html': 'pending' },
          defaultUrl: 'guard.html'
        },
        {
          id: 'nav-guard-deliveries',
          label: 'Parcel Deliveries',
          icon: 'guard-deliveries',
          roles: ['Security Guard'],
          targetTab: { 'guard.html': 'deliveries' },
          defaultUrl: 'guard.html'
        },
        {
          id: 'nav-vehicles',
          label: 'Vehicles & Parking',
          icon: 'vehicles',
          roles: ['Admin', 'Resident', 'Security Guard', 'Committee Member'],
          url: 'vehicles.html'
        },
        {
          id: 'nav-emergency',
          label: 'Emergency Alerts / SOS',
          icon: 'emergency',
          roles: ['Resident', 'Security Guard'],
          targetTab: {
            'resident.html': 'tab-res-sos-btn',
            'guard.html': 'emergency'
          },
          defaultUrl: {
            'Resident': 'resident.html#tab-res-sos',
            'Security Guard': 'guard.html'
          }
        }
      ]
    },
    {
      section: 'Finance & Billing',
      roles: ['Admin', 'Resident', 'Committee Member'],
      items: [
        {
          id: 'nav-finance',
          label: 'Maintenance & Dues',
          icon: 'finance',
          roles: ['Admin', 'Resident', 'Committee Member'],
          submenu: [
            {
              id: 'sub-billing',
              label: 'Maintenance Billing',
              roles: ['Admin'],
              targetTab: { 'admin.html': 'tab-billing-btn' },
              defaultUrl: 'admin.html#tab-billing'
            },
            {
              id: 'sub-mybills',
              label: 'My Invoices & Receipts',
              roles: ['Resident'],
              targetTab: { 'resident.html': 'tab-res-bills-btn' },
              defaultUrl: 'resident.html#tab-res-bills'
            },
            {
              id: 'sub-expenses',
              label: 'Society Expenses',
              roles: ['Admin', 'Committee Member'],
              targetTab: {
                'admin.html': 'tab-expenses-btn',
                'committee.html': 'tab-expenses'
              },
              defaultUrl: {
                'Admin': 'admin.html#tab-expenses',
                'Committee Member': 'committee.html#tab-expenses'
              }
            },
            {
              id: 'sub-collections',
              label: 'Collection Analytics',
              roles: ['Committee Member'],
              targetTab: { 'committee.html': 'tab-collections' },
              defaultUrl: 'committee.html#tab-collections'
            }
          ]
        }
      ]
    },
    {
      section: 'Amenities & Events',
      roles: ['Admin', 'Resident'],
      items: [
        {
          id: 'nav-amenities',
          label: 'Amenity Reservations',
          icon: 'amenities',
          roles: ['Admin', 'Resident'],
          targetTab: {
            'admin.html': 'tab-amenities-btn',
            'resident.html': 'tab-res-amenities-btn'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-amenities',
            'Resident': 'resident.html#tab-res-amenities'
          }
        },
        {
          id: 'nav-notices',
          label: 'Notices & Bulletins',
          icon: 'notices',
          roles: ['Admin', 'Resident', 'Committee Member'],
          targetTab: {
            'admin.html': 'tab-notices-btn',
            'resident.html': 'tab-res-notices-btn',
            'committee.html': 'tab-notices'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-notices',
            'Resident': 'resident.html#tab-res-notices',
            'Committee Member': 'committee.html#tab-notices'
          }
        },
        {
          id: 'nav-polls',
          label: 'Society Polls',
          icon: 'polls',
          roles: ['Admin', 'Resident', 'Committee Member'],
          targetTab: {
            'admin.html': 'tab-polls-btn',
            'resident.html': 'tab-res-polls-btn',
            'committee.html': 'tab-polls'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-polls',
            'Resident': 'resident.html#tab-res-polls',
            'Committee Member': 'committee.html#tab-polls'
          }
        },
        {
          id: 'nav-documents',
          label: 'Society Documents',
          icon: 'documents',
          roles: ['Resident'],
          targetTab: { 'resident.html': 'tab-res-documents-btn' },
          defaultUrl: 'resident.html#tab-res-documents'
        }
      ]
    },
    {
      section: 'Management & System',
      roles: ['Admin', 'Committee Member', 'Super Admin'],
      items: [
        {
          id: 'nav-reports',
          label: 'Reports & Audits',
          icon: 'reports',
          roles: ['Admin', 'Committee Member'],
          targetTab: {
            'admin.html': 'tab-reports-btn',
            'committee.html': 'tab-reports'
          },
          defaultUrl: {
            'Admin': 'admin.html#tab-reports',
            'Committee Member': 'committee.html#tab-reports'
          }
        },
        {
          id: 'nav-audit',
          label: 'Security Audit Logs',
          icon: 'audit',
          roles: ['Admin'],
          targetTab: { 'admin.html': 'tab-audit-btn' },
          defaultUrl: 'admin.html#tab-audit'
        },
        {
          id: 'nav-roles',
          label: 'Role & User Access',
          icon: 'roles',
          roles: ['Admin'],
          targetTab: { 'admin.html': 'tab-roles-btn' },
          defaultUrl: 'admin.html#tab-roles'
        }
      ]
    }
  ];

  // Tooltip DOM element
  let tooltipEl = null;

  function getCurrentUser() {
    try {
      const page = getPageFilename();
      if (page === 'super-admin.html' || page === 'super-admin') {
        const sa = sessionStorage.getItem('ssm_super_admin');
        if (sa) {
          const parsed = JSON.parse(sa);
          return { name: parsed.name || 'System Owner', role: 'Super Admin', societyName: 'Platform Owner' };
        }
        return { name: 'System Owner', role: 'Super Admin', societyName: 'Platform Owner' };
      }
      if (window.SystemDB && typeof window.SystemDB.getCurrentUser === 'function') {
        const u = window.SystemDB.getCurrentUser();
        if (u) {
          const socName = u.societyName || sessionStorage.getItem('ssm_society_name')
            || (window.SystemDB.data && window.SystemDB.data.societySettings && window.SystemDB.data.societySettings.name);
          if (socName) u.societyName = socName;
          return u;
        }
      }
      const raw = sessionStorage.getItem('ssm_current_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.role === 'SUPER_ADMIN' || parsed.role === 'Super Admin') {
          return { ...parsed, role: 'Super Admin', societyName: 'Platform Owner' };
        }
        const socName = parsed.societyName || sessionStorage.getItem('ssm_society_name');
        if (socName) parsed.societyName = socName;
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return { name: 'Member', role: 'Resident', flat: 'A-101' };
  }

  function getPageFilename() {
    const path = window.location.pathname.split('/');
    const file = path[path.length - 1] || 'index.html';
    if (file === 'super-admin') return 'super-admin.html';
    return file;
  }

  function initTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'leonex-tooltip';
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(target, text) {
    if (!tooltipEl || !document.body.classList.contains('leonex-collapsed')) return;
    tooltipEl.textContent = text;
    const rect = target.getBoundingClientRect();
    const tooltipHeight = 28;
    tooltipEl.style.left = (rect.right + 12) + 'px';
    tooltipEl.style.top = (rect.top + (rect.height / 2) - (tooltipHeight / 2)) + 'px';
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  }

  function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('leonex-collapsed');
    try {
      localStorage.setItem(STORAGE_KEY, isCollapsed ? 'true' : 'false');
    } catch (e) { }

    hideTooltip();
    if (window._dismissLeonexHoverPill) {
      window._dismissLeonexHoverPill();
    }

    setTimeout(() => {
      const currentActive = document.querySelector('.leonex-nav-item.active, .leonex-sub-item.active');
      if (currentActive && window._moveLeonexActivePill) {
        window._moveLeonexActivePill(currentActive, true);
      }
      window.dispatchEvent(new Event('resize'));
    }, 250);
  }

  function renderSidebar() {
    const user = getCurrentUser();
    const userRole = user.role || 'Resident';
    const currentPage = getPageFilename();

    // Check stored collapsed preference
    let isCollapsed = false;
    try {
      isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) { }

    if (isCollapsed) {
      document.body.classList.add('leonex-collapsed');
    } else {
      document.body.classList.remove('leonex-collapsed');
    }

    const container = document.getElementById('leonexSidebar');
    if (!container) return;

    document.body.classList.add('leonex-page');

    const isCommEnabled = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
      ? SystemDB.isCommitteeEnabled()
      : true;
    const effectiveRole = (userRole === 'Committee Member' && !isCommEnabled) ? 'Resident' : userRole;

    const isSuperAdmin = (effectiveRole || '').toLowerCase().includes('super');
    const brandUrl = isSuperAdmin ? 'super-admin.html' : (
      effectiveRole === 'Admin' ? 'admin.html' : (
        effectiveRole === 'Security Guard' ? 'guard.html' : (
          effectiveRole === 'Committee Member' ? 'committee.html' : 'resident.html'
        )
      )
    );

    // Build Leonex Logo & Header (21st.dev Animated Sidebar Layout)
    let html = `
      <!-- Edge Docked Collapse/Expand Button Pill -->
      <button class="leonex-toggle-pill" id="leonexTogglePill" aria-label="Toggle Sidebar" title="Collapse / Expand Sidebar (Ctrl+B)">
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <!-- 21st.dev Animated Sidebar Rail Strip -->
      <button class="leonex-sidebar-rail" id="leonexSidebarRail" aria-label="Toggle Sidebar Rail" title="Toggle Sidebar (Ctrl+B)"></button>

      <!-- Sidebar Header -->
      <div class="leonex-sidebar-header">
        <a href="${brandUrl}" class="leonex-brand" title="Leonex Smart Society Platform">
          <div class="leonex-brand-logo" style="overflow: hidden; display: flex; align-items: center; justify-content: center; border-radius: 8px; padding: 2px;">
            <img src="images/favicon.png" alt="Leonex Logo" style="width: 22px; height: 22px; object-fit: contain;">
          </div>
          <div class="leonex-brand-info">
            <div class="leonex-brand-title">Leonex <span>SSMS</span></div>
            <div class="leonex-brand-sub">${escapeHtml(userRole === 'Super Admin' ? 'System Owner' : (user.societyName || 'Royal Residency'))}</div>
          </div>
        </a>
      </div>

      <!-- Navigation Body -->
      <nav class="leonex-sidebar-nav" id="leonexSidebarNav">
        <!-- 21st.dev SharedLayoutBg Magic Gliding Active Pill (shifts on click) -->
        <div class="leonex-active-pill" id="leonexActivePill" aria-hidden="true"></div>
        <!-- 21st.dev SharedLayoutBg Magic Gliding Hover Pill (shifts on hover) -->
        <div class="leonex-hover-pill" id="leonexHoverPill" aria-hidden="true"></div>
    `;

    function roleMatches(allowedRoles, role) {
      if (!allowedRoles || allowedRoles.length === 0) return true;
      const current = (role || 'Resident').trim().toLowerCase();
      return allowedRoles.some(r => {
        const target = r.trim().toLowerCase();
        if (target === current) return true;
        if (target === 'super admin' && (current === 'super_admin' || current === 'superadmin')) return true;
        if (target === 'committee member' && (current === 'committee' || current === 'secretary')) return true;
        if (target === 'security guard' && (current === 'guard' || current === 'security')) return true;
        return false;
      });
    }

    // Filter and Render Sections
    LEONEX_NAV_CONFIG.forEach(section => {
      if (isSuperAdmin) {
        if (!roleMatches(section.roles, 'Super Admin')) return;
      } else {
        const isSectionSuperAdminOnly = section.roles && section.roles.every(r => r.toLowerCase().includes('super'));
        if (isSectionSuperAdminOnly) return;
        if (!roleMatches(section.roles, effectiveRole)) return;
      }

      const visibleItems = section.items.filter(item => {
        if (!item.roles) return true;
        if (isSuperAdmin) {
          return roleMatches(item.roles, 'Super Admin');
        }
        const isItemSuperAdminOnly = item.roles.every(r => r.toLowerCase().includes('super'));
        if (isItemSuperAdminOnly) return false;
        return roleMatches(item.roles, effectiveRole);
      });

      if (visibleItems.length === 0) return;

      html += `
        <div class="leonex-nav-section">
          <div class="leonex-nav-section-title">${escapeHtml(section.section)}</div>
      `;

      visibleItems.forEach(item => {
        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;
        const targetTabId = item.targetTab ? item.targetTab[currentPage] : null;
        let itemUrl = 'javascript:void(0);';

        if (item.url) {
          itemUrl = item.url;
        } else if (item.defaultUrl) {
          if (typeof item.defaultUrl === 'object') {
            itemUrl = item.defaultUrl[userRole] || Object.values(item.defaultUrl)[0];
          } else {
            itemUrl = item.defaultUrl;
          }
        }

        const isCurrentPage = item.url && currentPage === item.url;

        html += `
          <div class="leonex-nav-item-wrap">
            <a class="leonex-nav-item ${isCurrentPage ? 'active' : ''}" 
               id="${item.id}" 
               href="${itemUrl}" 
               data-tooltip="${escapeHtml(item.label)}"
               ${targetTabId ? `data-tab-target="${targetTabId}"` : ''}
               ${hasSubmenu ? 'aria-expanded="false" data-has-submenu="true"' : ''}>
              <div class="leonex-nav-icon">${getIconHtml(item.icon)}</div>
              <span class="leonex-nav-label">${escapeHtml(item.label)}</span>
              ${hasSubmenu ? '<i class="fa-solid fa-chevron-down leonex-nav-chevron"></i>' : ''}
            </a>
        `;

        if (hasSubmenu) {
          html += `<div class="leonex-submenu" id="${item.id}-submenu">`;
          item.submenu.forEach(sub => {
            if (sub.roles) {
              if (isSuperAdmin && !roleMatches(sub.roles, 'Super Admin')) return;
              if (!isSuperAdmin && !roleMatches(sub.roles, userRole)) return;
            }

            const subTargetTab = sub.targetTab ? sub.targetTab[currentPage] : null;
            let subUrl = 'javascript:void(0);';
            if (sub.url) {
              subUrl = sub.url;
            } else if (sub.defaultUrl) {
              if (typeof sub.defaultUrl === 'object') {
                subUrl = sub.defaultUrl[userRole] || Object.values(sub.defaultUrl)[0];
              } else {
                subUrl = sub.defaultUrl;
              }
            }

            html += `
              <a class="leonex-sub-item" 
                 href="${subUrl}" 
                 data-tooltip="${escapeHtml(sub.label)}"
                 ${subTargetTab ? `data-tab-target="${subTargetTab}"` : ''}>
                <span>${escapeHtml(sub.label)}</span>
              </a>
            `;
          });
          html += `</div>`;
        }

        html += `</div>`;
      });

      html += `</div>`;
    });

    html += `
      </nav>

      <!-- Sidebar Footer User Profile -->
      <div class="leonex-sidebar-footer">
        <div class="leonex-user-card" id="leonexUserCard" data-tooltip="Profile Settings & Account" role="button" tabindex="0" title="Account & Profile Settings">
          <div class="leonex-user-avatar-wrap">
            <img class="leonex-user-avatar" id="leonexUserAvatar" src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(user.name || 'Felix')}" alt="User Avatar">
            <span class="leonex-avatar-badge" title="Profile Settings"><i class="fa-solid fa-gear"></i></span>
          </div>
          <div class="leonex-user-info" id="leonexUserInfo">
            <div class="leonex-user-name" id="leonexUserName">${escapeHtml(user.name || 'Member')}</div>
            <div class="leonex-user-role" id="leonexUserRole">${escapeHtml(userRole)} ${user.flat ? '&bull; ' + escapeHtml(user.flat) : ''}</div>
          </div>
          <button class="leonex-user-action" id="leonexLogoutBtn" title="Logout" aria-label="Logout">
            ${getIconHtml('logout')}
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach Event Listeners
    attachSidebarEvents();
    initTooltip();
    syncActiveState();
    window.addEventListener('hashchange', syncActiveState);
  }

  function attachSidebarEvents() {
    const toggleBtn = document.getElementById('leonexTogglePill');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleSidebar);
    }

    const railBtn = document.getElementById('leonexSidebarRail');
    if (railBtn) {
      railBtn.addEventListener('click', toggleSidebar);
    }

    const logoutBtn = document.getElementById('leonexLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Sign out from Clerk if session exists
        if (window.Clerk && window.Clerk.user) {
          try {
            await window.Clerk.signOut();
          } catch (err) {
            console.warn('Clerk signout warning:', err);
          }
        }

        if (typeof window.logout === 'function') {
          window.logout();
        } else if (window.SystemDB && typeof window.SystemDB.logout === 'function') {
          window.SystemDB.logout();
        }

        sessionStorage.clear();
        window.location.href = 'login.html';
      });
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // 21ST.DEV / BE UI SHARED-LAYOUT ACTIVE & HOVER PILL CONTROLLER
    // Smooth, continuous spring-physics sliding background indicator across nav items
    // ══════════════════════════════════════════════════════════════════════════════
    const navContainer = document.getElementById('leonexSidebarNav');
    const hoverPill = document.getElementById('leonexHoverPill');
    const activePill = document.getElementById('leonexActivePill');
    let isPillActive = false;
    let currentlyHoveredItem = null;
    let pillDismissTimer = null;
    let isActivePillInitialized = false;

    function moveHoverPill(targetItem) {
      if (!targetItem || !hoverPill || !navContainer) return;
      if (pillDismissTimer) {
        clearTimeout(pillDismissTimer);
        pillDismissTimer = null;
      }
      currentlyHoveredItem = targetItem;

      const navRect = navContainer.getBoundingClientRect();
      const itemRect = targetItem.getBoundingClientRect();

      const top = itemRect.top - navRect.top + navContainer.scrollTop;
      const left = itemRect.left - navRect.left + navContainer.scrollLeft;
      const width = itemRect.width;
      const height = itemRect.height;

      const isSub = targetItem.classList.contains('leonex-sub-item');
      const isCollapsed = document.body.classList.contains('leonex-collapsed');

      hoverPill.style.width = width + 'px';
      hoverPill.style.height = height + 'px';
      hoverPill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      hoverPill.style.borderRadius = isCollapsed ? '10px' : (isSub ? '8px' : '10px');

      if (!isPillActive) {
        // Instant position on first entry to avoid flying from top-left, then fade & de-blur in
        hoverPill.style.transition = 'none';
        void hoverPill.offsetHeight; // force reflow
        hoverPill.style.transition = '';
        hoverPill.classList.add('visible');
        isPillActive = true;
      }
    }

    function dismissHoverPill(immediate = false) {
      if (!hoverPill || !isPillActive) return;
      if (pillDismissTimer) {
        clearTimeout(pillDismissTimer);
        pillDismissTimer = null;
      }
      if (immediate) {
        hoverPill.classList.remove('visible');
        isPillActive = false;
        currentlyHoveredItem = null;
      } else {
        pillDismissTimer = setTimeout(() => {
          hoverPill.classList.remove('visible');
          isPillActive = false;
          currentlyHoveredItem = null;
        }, 120);
      }
    }

    window._dismissLeonexHoverPill = () => dismissHoverPill(true);

    function moveActivePill(targetItem, animate = true) {
      if (!targetItem || !activePill || !navContainer) return;

      const navRect = navContainer.getBoundingClientRect();
      const itemRect = targetItem.getBoundingClientRect();
      if (itemRect.width === 0 || itemRect.height === 0) return;

      const top = itemRect.top - navRect.top + navContainer.scrollTop;
      const left = itemRect.left - navRect.left + navContainer.scrollLeft;
      const width = itemRect.width;
      const height = itemRect.height;

      const isSub = targetItem.classList.contains('leonex-sub-item');
      const isCollapsed = document.body.classList.contains('leonex-collapsed');

      activePill.style.width = width + 'px';
      activePill.style.height = height + 'px';
      activePill.style.borderRadius = isCollapsed ? '10px' : (isSub ? '8px' : '10px');

      if (!isActivePillInitialized || !animate) {
        // First initialization: snap without flying from (0,0)
        activePill.style.transition = 'none';
        activePill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        void activePill.offsetHeight; // force reflow
        activePill.style.transition = '';
        activePill.classList.add('visible');
        isActivePillInitialized = true;
      } else {
        // Shifting animation from previous clicked page to user clicked page
        activePill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        activePill.classList.add('visible');
      }
    }

    window._moveLeonexActivePill = moveActivePill;

    if (navContainer) {
      navContainer.addEventListener('mouseleave', () => dismissHoverPill(false));
      navContainer.addEventListener('scroll', () => {
        if (currentlyHoveredItem && isPillActive) {
          const navRect = navContainer.getBoundingClientRect();
          const itemRect = currentlyHoveredItem.getBoundingClientRect();
          const top = itemRect.top - navRect.top + navContainer.scrollTop;
          const left = itemRect.left - navRect.left + navContainer.scrollLeft;
          hoverPill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        }
        const currentActive = document.querySelector('.leonex-nav-item.active, .leonex-sub-item.active');
        if (currentActive && activePill && isActivePillInitialized) {
          const navRect = navContainer.getBoundingClientRect();
          const itemRect = currentActive.getBoundingClientRect();
          const top = itemRect.top - navRect.top + navContainer.scrollTop;
          const left = itemRect.left - navRect.left + navContainer.scrollLeft;
          activePill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        }
      }, { passive: true });
    }

    // Keep active pill aligned on window resize
    window.addEventListener('resize', () => {
      const currentActive = document.querySelector('.leonex-nav-item.active, .leonex-sub-item.active');
      if (currentActive && window._moveLeonexActivePill) {
        window._moveLeonexActivePill(currentActive, false);
      }
    });

    // Non-interactive titles dismiss the sliding hover pill cleanly with grace period
    document.querySelectorAll('.leonex-nav-section-title').forEach(title => {
      title.addEventListener('mouseenter', () => dismissHoverPill(false));
    });

    // User Profile Card Hover, Tooltip & Modal Settings Click
    const userCard = document.getElementById('leonexUserCard');
    if (userCard) {
      userCard.addEventListener('click', (e) => {
        if (e.target.closest('#leonexLogoutBtn')) return;
        openLeonexProfileModal();
      });
      userCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('#leonexLogoutBtn')) return;
          e.preventDefault();
          openLeonexProfileModal();
        }
      });
      userCard.addEventListener('mouseenter', () => {
        dismissHoverPill(true);
        const text = userCard.getAttribute('data-tooltip') || 'Account & Profile Settings';
        if (text) showTooltip(userCard, text);
      });
      userCard.addEventListener('mouseleave', hideTooltip);
    }

    // Keyboard shortcut (Ctrl+B / Cmd+B) and Esc sheet close
    if (!window._leonexShortcutAttached) {
      window._leonexShortcutAttached = true;
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            return;
          }
          e.preventDefault();
          toggleSidebar();
        } else if (e.key === 'Escape') {
          if (document.body.classList.contains('leonex-mobile-open')) {
            closeMobileDrawer();
          }
        }
      });
    }

    // Nav Item & Submenu Item Clicks, Hovers & Tooltip Listeners
    const allItems = document.querySelectorAll('.leonex-nav-item, .leonex-sub-item');
    allItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        // If hovering over the active item, dismiss the hover pill so no double box shows
        if (!item.classList.contains('active')) {
          moveHoverPill(item);
        } else {
          dismissHoverPill(false);
        }
        const text = item.getAttribute('data-tooltip');
        if (text) showTooltip(item, text);
      });

      item.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      item.addEventListener('click', (e) => {
        // Check submenu toggle
        if (item.getAttribute('data-has-submenu') === 'true') {
          if (document.body.classList.contains('leonex-collapsed')) {
            // Expand on click if collapsed
            toggleSidebar();
          }
          const submenu = document.getElementById(item.id + '-submenu');
          if (submenu) {
            const isOpen = submenu.classList.toggle('open');
            item.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            setTimeout(() => {
              if (item === currentlyHoveredItem) moveHoverPill(item);
              const currentActive = document.querySelector('.leonex-nav-item.active, .leonex-sub-item.active');
              if (currentActive && window._moveLeonexActivePill) {
                window._moveLeonexActivePill(currentActive, true);
              }
            }, 260);
          }
          return;
        }

        // Check Tab Targeting
        const tabTarget = item.getAttribute('data-tab-target');
        if (tabTarget) {
          const currentPage = getPageFilename();
          hideTooltip();

          // If on admin.html, trigger Bootstrap tab button
          const btn = document.getElementById(tabTarget);
          if (btn) {
            e.preventDefault();
            if (window.bootstrap && bootstrap.Tab) {
              bootstrap.Tab.getOrCreateInstance(btn).show();
            } else {
              btn.click();
            }
            const paneTarget = btn.getAttribute('data-bs-target');
            if (paneTarget && paneTarget.startsWith('#')) {
              history.replaceState(null, '', paneTarget);
            }
            updateActiveState(item);
            closeMobileDrawer();
            return;
          }

          // If on guard.html, trigger data-guard-tab
          if (currentPage === 'guard.html') {
            const guardBtn = document.querySelector(`[data-guard-tab="${tabTarget}"]`);
            if (guardBtn) {
              e.preventDefault();
              guardBtn.click();
              updateActiveState(item);
              closeMobileDrawer();
              return;
            }
          }

          // If on committee.html, trigger tab
          if (currentPage === 'committee.html') {
            const commBtn = document.querySelector(`[data-bs-target="#${tabTarget}"]`);
            if (commBtn) {
              e.preventDefault();
              if (window.bootstrap && bootstrap.Tab) {
                bootstrap.Tab.getOrCreateInstance(commBtn).show();
              } else {
                commBtn.click();
              }
              updateActiveState(item);
              closeMobileDrawer();
              return;
            }
          }
        }

        // For regular navigation links: update active state so the pill starts gliding, then navigate
        const href = item.getAttribute('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          e.preventDefault();
          updateActiveState(item);
          setTimeout(() => {
            window.location.href = href;
          }, 240);
          return;
        }

        updateActiveState(item);
        closeMobileDrawer();
      });
    });
  }

  function updateActiveState(activeItem) {
    if (!activeItem) return;
    document.querySelectorAll('.leonex-nav-item, .leonex-sub-item').forEach(el => el.classList.remove('active'));
    activeItem.classList.add('active');
    // If it's a sub-item, also highlight parent
    const parentWrap = activeItem.closest('.leonex-nav-item-wrap');
    if (parentWrap) {
      const parentItem = parentWrap.querySelector('.leonex-nav-item');
      if (parentItem && parentItem !== activeItem) parentItem.classList.add('active');
    }

    // Dismiss the hover pill immediately so the user can clearly see the active gray box glide across
    if (window._dismissLeonexHoverPill) {
      window._dismissLeonexHoverPill(true);
    }

    if (window._moveLeonexActivePill) {
      window._moveLeonexActivePill(activeItem, true);
    }
  }

  function syncActiveState() {
    const currentPage = getPageFilename();
    const hash = window.location.hash;

    let matched = false;

    // 1. Check if hash matches an item
    if (hash) {
      document.querySelectorAll('.leonex-nav-item, .leonex-sub-item').forEach(item => {
        if (matched) return;
        const href = item.getAttribute('href');
        const tabTarget = item.getAttribute('data-tab-target');
        const cleanHash = hash.replace('#', '');
        if (
          (href && href.endsWith(hash)) ||
          (tabTarget && (tabTarget === cleanHash + '-btn' || tabTarget === cleanHash || cleanHash.includes(tabTarget)))
        ) {
          updateActiveState(item);
          matched = true;
        }
      });
    }

    if (matched) return;

    // 2. Check by exact page URL
    document.querySelectorAll('.leonex-nav-item').forEach(item => {
      if (matched) return;
      const href = item.getAttribute('href');
      if (href && (href === currentPage || href === '/' + currentPage)) {
        updateActiveState(item);
        matched = true;
      }
    });

    if (!matched) {
      const firstItem = document.querySelector('.leonex-nav-item');
      if (firstItem) updateActiveState(firstItem);
    }
  }

  function closeMobileDrawer() {
    document.body.classList.remove('leonex-mobile-open');
  }

  function initMobileDrawer() {
    // Backdrop
    let backdrop = document.querySelector('.leonex-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'leonex-sidebar-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.addEventListener('click', closeMobileDrawer);

    // Mobile Hamburger
    const toggles = document.querySelectorAll('.leonex-mobile-toggle, [data-leonex-mobile-toggle]');
    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.classList.toggle('leonex-mobile-open');
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderSidebar();
      initMobileDrawer();
    });
  } else {
    renderSidebar();
    initMobileDrawer();
  }

  const PRESET_AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jenil',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Suresh',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Ramesh',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
  ];

  function openLeonexProfileModal() {
    hideTooltip();
    let modalEl = document.getElementById('leonexProfileModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'leonexProfileModal';
      modalEl.className = 'modal fade lx-profile-modal';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modalEl);
    }

    const user = getCurrentUser();
    const userRole = user.role || 'Resident';
    let currentAvatar = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'User')}`;

    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
        <div class="modal-content border-0">
          <div class="modal-header border-bottom px-4 pt-4 pb-3 align-items-center">
            <div>
              <h5 class="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                <i class="fa-solid fa-user-gear text-primary fs-5"></i>
                <span>Profile & Account Settings</span>
              </h5>
              <div class="text-muted fs-8 mt-1">Manage your identity, personal details, and account security</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <form id="lxProfileForm">
            <div class="modal-body px-4 py-4">
              <!-- Top Avatar Selector Section -->
              <div class="text-center mb-4">
                <div class="lx-avatar-preview-wrap mb-2">
                  <img id="lxAvatarPreview" class="lx-avatar-preview-img" src="${escapeHtml(currentAvatar)}" alt="Profile Photo">
                  <label for="lxAvatarUploadInput" class="lx-avatar-upload-btn" title="Upload custom photo">
                    <i class="fa-solid fa-camera"></i>
                  </label>
                  <input type="file" id="lxAvatarUploadInput" accept="image/*" class="d-none">
                </div>
                <div class="fs-8 fw-semibold mb-2 text-muted">Choose an avatar preset or upload your photo</div>
                <div class="lx-preset-avatars" id="lxPresetContainer">
                  ${PRESET_AVATARS.map(url => `
                    <img src="${url}" class="lx-preset-chip ${url === currentAvatar ? 'active' : ''}" data-avatar="${url}" alt="Preset Avatar" title="Select preset">
                  `).join('')}
                </div>
              </div>

              <!-- Personal Information Fields -->
              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label fs-8 fw-semibold mb-1">Full Name</label>
                  <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 text-muted"><i class="fa-solid fa-user"></i></span>
                    <input type="text" id="lxProfileName" class="form-control border-start-0 ps-0" value="${escapeHtml(user.name || '')}" required placeholder="Enter full name">
                  </div>
                </div>

                <div class="col-md-6">
                  <label class="form-label fs-8 fw-semibold mb-1">Email Address</label>
                  <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 text-muted"><i class="fa-solid fa-envelope"></i></span>
                    <input type="email" id="lxProfileEmail" class="form-control border-start-0 ps-0" value="${escapeHtml(user.email || '')}" required placeholder="user@example.com">
                  </div>
                </div>

                <div class="col-md-6">
                  <label class="form-label fs-8 fw-semibold mb-1">Phone Number</label>
                  <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 text-muted"><i class="fa-solid fa-phone"></i></span>
                    <input type="tel" id="lxProfilePhone" class="form-control border-start-0 ps-0" value="${escapeHtml(user.phone || '')}" placeholder="10-digit mobile">
                  </div>
                </div>

                <!-- Account Scope Details (Read-only pills) -->
                <div class="col-12">
                  <div class="p-3 rounded-3" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.18);">
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div>
                        <div class="fs-9 text-uppercase tracking-wider fw-bold text-muted">Role & Assignment</div>
                        <div class="fw-bold fs-7 text-primary mt-1 d-flex align-items-center gap-2">
                          <i class="fa-solid fa-shield-halved"></i> ${escapeHtml(userRole)}
                          ${user.flat ? `<span class="badge rounded-pill bg-light text-dark border fs-9 fw-semibold">Flat ${escapeHtml(user.flat)}</span>` : ''}
                        </div>
                      </div>
                      <div class="text-end">
                        <div class="fs-9 text-uppercase tracking-wider fw-bold text-muted">Housing Society</div>
                        <div class="fw-semibold fs-7 text-body mt-1">
                          ${escapeHtml(userRole === 'Super Admin' ? 'Platform Wide' : (user.societyName || 'Royal Residency'))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Security Password Section Toggle -->
                <div class="col-12 mt-2">
                  <div class="d-flex align-items-center justify-content-between">
                    <span class="fs-8 fw-semibold text-muted">Security Settings</span>
                    <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none fs-8 fw-semibold" id="lxTogglePasswordBtn">
                      <i class="fa-solid fa-key me-1"></i> Change Password
                    </button>
                  </div>
                  <div id="lxPasswordBox" class="mt-2 d-none">
                    <div class="input-group mb-2">
                      <span class="input-group-text bg-transparent border-end-0 text-muted"><i class="fa-solid fa-lock"></i></span>
                      <input type="password" id="lxNewPassword" class="form-control border-start-0 ps-0" placeholder="New Password (min 4 characters)">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer border-top px-4 py-3 d-flex justify-content-between">
              <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm rounded-pill px-4 fw-semibold d-inline-flex align-items-center gap-2" id="lxSaveProfileBtn">
                <i class="fa-solid fa-floppy-disk"></i> Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Hook preset avatar chips
    const presetContainer = modalEl.querySelector('#lxPresetContainer');
    presetContainer.querySelectorAll('.lx-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        presetContainer.querySelectorAll('.lx-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentAvatar = chip.getAttribute('data-avatar');
        document.getElementById('lxAvatarPreview').src = currentAvatar;
      });
    });

    // Custom image upload
    const uploadInput = modalEl.querySelector('#lxAvatarUploadInput');
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          currentAvatar = evt.target.result;
          document.getElementById('lxAvatarPreview').src = currentAvatar;
          presetContainer.querySelectorAll('.lx-preset-chip').forEach(c => c.classList.remove('active'));
        };
        reader.readAsDataURL(file);
      }
    });

    // Toggle password box
    const togglePassBtn = modalEl.querySelector('#lxTogglePasswordBtn');
    const passBox = modalEl.querySelector('#lxPasswordBox');
    togglePassBtn.addEventListener('click', () => {
      passBox.classList.toggle('d-none');
      if (!passBox.classList.contains('d-none')) {
        document.getElementById('lxNewPassword').focus();
      }
    });

    // Form submission
    const form = modalEl.querySelector('#lxProfileForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const updatedName = document.getElementById('lxProfileName').value.trim();
      const updatedEmail = document.getElementById('lxProfileEmail').value.trim();
      const updatedPhone = document.getElementById('lxProfilePhone').value.trim();
      const newPass = document.getElementById('lxNewPassword') ? document.getElementById('lxNewPassword').value : '';

      if (!updatedName) {
        alert('Please enter your full name');
        return;
      }

      // Update SystemDB
      if (window.SystemDB && typeof window.SystemDB.updateProfile === 'function') {
        window.SystemDB.updateProfile({
          name: updatedName,
          email: updatedEmail,
          phone: updatedPhone,
          avatar: currentAvatar
        });
        if (newPass && newPass.length >= 4) {
          const cur = window.SystemDB.getCurrentUser();
          if (cur && window.SystemDB.data && window.SystemDB.data.users) {
            const u = window.SystemDB.data.users.find(x => x.id === cur.id || x.email === cur.email);
            if (u) {
              u.password = newPass;
              window.SystemDB.save();
            }
          }
        }
      }

      // Update Session Storage & Local Storage
      const updatedUser = {
        ...user,
        name: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        avatar: currentAvatar
      };

      try {
        sessionStorage.setItem('ssm_current_user', JSON.stringify(updatedUser));
        sessionStorage.setItem('leonex_current_user', JSON.stringify(updatedUser));
        if (updatedUser.role === 'Super Admin' || (userRole || '').toLowerCase().includes('super')) {
          localStorage.setItem('leonex_superadmin_session', JSON.stringify(updatedUser));
        }
      } catch (err) { }

      // Update Sidebar user card in real time
      const sideAvatar = document.getElementById('leonexUserAvatar');
      if (sideAvatar) sideAvatar.src = currentAvatar;
      const sideName = document.getElementById('leonexUserName');
      if (sideName) sideName.textContent = updatedName;
      const card = document.getElementById('leonexUserCard');
      if (card) card.setAttribute('data-tooltip', `${updatedName} (${userRole})`);

      // Trigger global toast
      if (typeof window.showToast === 'function') {
        window.showToast('Profile updated successfully!', 'success');
      } else {
        showGlobalMiniToast('Profile updated successfully!');
      }

      // Close modal
      if (window.bootstrap && window.bootstrap.Modal) {
        const bsModal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        bsModal.hide();
      } else {
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
      }
    });

    // Show modal via Bootstrap or fallback
    if (window.bootstrap && window.bootstrap.Modal) {
      const bsModal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
      bsModal.show();
    } else {
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
    }
  }

  function showGlobalMiniToast(msg) {
    let toast = document.getElementById('lxGlobalMiniToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lxGlobalMiniToast';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:#10B981;color:#fff;padding:12px 20px;border-radius:50px;box-shadow:0 10px 25px rgba(0,0,0,0.25);font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;transition:all 0.3s ease;transform:translateY(100px);opacity:0;';
      toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="lxGlobalMiniToastMsg"></span>';
      document.body.appendChild(toast);
    }
    document.getElementById('lxGlobalMiniToastMsg').textContent = msg;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
    }, 3000);
  }

  // Export controller
  window.LeonexSidebar = {
    render: renderSidebar,
    toggle: toggleSidebar,
    closeMobile: closeMobileDrawer,
    openProfileModal: openLeonexProfileModal
  };
  window.openLeonexProfileModal = openLeonexProfileModal;
})();
