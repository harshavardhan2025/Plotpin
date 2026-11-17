/**
 * LANDPIN LUXURY REALTY & LEGAL CONCIERGE
 * Core Application Controller
 */

// Application State
const AppState = {
  // Device mode: 'desktop' | 'mobile'
  deviceMode: 'desktop',
  
  // Active Navigation View: 'explore' | 'search' | 'concierge' | 'escrow' | 'register' | 'profile'
  currentView: 'explore',
  
  // Role & Account Architecture:
  // - 'buyer': Unified Client (Buyer / Tenant mode)
  // - 'seller': Unified Client (Owner / Seller mode - SAME account as buyer!)
  // - 'broker': Channel Partner / Broker (SEPARATE account)
  // - 'admin': Regional Escrow Admin (SEPARATE account, location-based!)
  currentRole: 'buyer',
  
  // Current Selected Location
  currentLocation: 'Indiranagar, 100ft Rd, BLR',
  
  // Admin Jurisdiction Location (Location-based admin)
  adminJurisdiction: 'blr-east', // 'blr-east', 'blr-north', 'blr-south', 'blr-central'
  
  // Standby Legal Concierge Toggle
  conciergeStandbyActive: true,
  
  // Escrow Vault Total in Crores
  escrowVaultTotal: 1.45,
  
  // Active Inquiries
  inquiries: [
    {
      id: '#LP-8492',
      property: 'Devanahalli Commercial #44',
      type: 'Surveyor Site Appointment & Stone Boundary',
      officer: 'Rajesh Sw...',
      role: 'Senior Cadastral Engineer',
      timeSlot: 'Today, 03:30 PM Slot',
      status: 'Assigned',
      badgeClass: 'status-badge-assigned',
      step: 2,
      locationZone: 'blr-north'
    },
    {
      id: '#LP-8384',
      property: 'Whitefield G+2 Villa',
      type: 'A-Khata Legal Title Search & EC Check',
      officer: 'Adv. Ananya K.',
      role: 'RERA Advocate',
      timeSlot: 'ETA: Today 4:00 PM',
      status: 'Under Review',
      badgeClass: 'status-badge-under-review',
      step: 1,
      locationZone: 'blr-east'
    }
  ],
  
  // Escrow Ledger Items
  escrowItems: [
    {
      id: '#ESC-8921',
      tag: 'Token Advance',
      property: 'Greenwood Penthouse, Unit 4B',
      amount: '₹5,00,000',
      statusText: 'Nodal Held',
      buyer: 'Vikramaditya Rao',
      buyerStatus: 'Verified Buyer',
      owner: 'Suresh Vardhan',
      ownerStatus: 'Registered Owner',
      milestones: [
        { text: '30-Year Encumbrance Search (Nil Lien)', status: 'PASSED' },
        { text: 'e-Khata Transfer (Sub-Registrar Slot)', status: 'TOMORROW 11 AM' }
      ],
      locationZone: 'blr-east',
      state: 'pending' // 'pending', 'held', 'paid'
    },
    {
      id: '#ESC-8924',
      tag: 'Boundary Security',
      property: 'Devanahalli 12,500 sq.ft Industrial',
      amount: '₹12,00,000',
      statusText: 'Trustee Locked',
      buyer: 'Apex Logistics Hub',
      buyerStatus: 'Institutional Buyer',
      owner: 'Kiran Reddy',
      ownerStatus: 'Direct Owner',
      milestones: [
        { text: 'Cadastral Drone Boundary Mapping', status: 'PASSED' },
        { text: 'KIADB NOC Verification', status: 'IN PROGRESS' }
      ],
      locationZone: 'blr-north',
      state: 'pending'
    }
  ]
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initDeviceSwitcher();
  initRoleSwitcher();
  initNavigation();
  initAccordions();
  initEscrowActions();
  initConciergeInteractions();
  initRegistrationFlow();
  renderJurisdictionDetails();
  
  // Show welcoming notification
  showToast('Welcome to LandPin: Select Desktop or Mobile App View anytime!');
});

/**
 * Device Switcher (Desktop Full Layout vs Mobile Simulator Frame)
 */
function initDeviceSwitcher() {
  const modeDesktopBtn = document.getElementById('modeDesktopBtn');
  const modeMobileBtn = document.getElementById('modeMobileBtn');
  const body = document.body;

  modeDesktopBtn.addEventListener('click', () => {
    AppState.deviceMode = 'desktop';
    body.classList.remove('view-mode-mobile');
    body.classList.add('view-mode-desktop');
    modeDesktopBtn.classList.add('active');
    modeMobileBtn.classList.remove('active');
    showToast('Switched to 🖥️ Desktop Full-Width Mode');
  });

  modeMobileBtn.addEventListener('click', () => {
    AppState.deviceMode = 'mobile';
    body.classList.remove('view-mode-desktop');
    body.classList.add('view-mode-mobile');
    modeMobileBtn.classList.add('active');
    modeDesktopBtn.classList.remove('active');
    showToast('Switched to 📱 Mobile Device Simulator (Pixel-Perfect Frame)');
  });
}

/**
 * Role & Account Architecture Controller
 * Unified Client (Buyer & Seller) | Separate Broker | Location-based Admin
 */
function initRoleSwitcher() {
  const roleButtons = document.querySelectorAll('.role-option-btn');
  const adminLocSelect = document.getElementById('adminLocSelect');
  const roleIndicatorBanner = document.getElementById('roleIndicatorBanner');
  const roleBannerText = document.getElementById('roleBannerText');

  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedRole = btn.getAttribute('data-role');
      switchRole(selectedRole);
    });
  });

  if (adminLocSelect) {
    adminLocSelect.addEventListener('change', (e) => {
      AppState.adminJurisdiction = e.target.value;
      renderJurisdictionDetails();
      showToast(`Admin Jurisdiction updated to: ${e.target.options[e.target.selectedIndex].text}`);
    });
  }
}

function switchRole(role) {
  AppState.currentRole = role;
  
  // Update button active state
  document.querySelectorAll('.role-option-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-role') === role);
  });

  const adminLocSelect = document.getElementById('adminLocSelect');
  const roleIndicatorBanner = document.getElementById('roleIndicatorBanner');
  const roleBannerText = document.getElementById('roleBannerText');
  const postAdPill = document.getElementById('postAdNavBtn');

  // Role Indicator Banner and Layout update
  if (role === 'buyer') {
    adminLocSelect.classList.remove('show');
    roleIndicatorBanner.className = 'account-role-indicator-banner';
    roleBannerText.innerHTML = `
      <span>👤 <strong>Unified Client Account:</strong> Vikramaditya Rao (Buyer/Tenant Mode)</span>
      <span class="role-switch-link" onclick="switchRole('seller')">Switch to Seller Mode ➔</span>
    `;
    switchView('explore');
  } else if (role === 'seller') {
    adminLocSelect.classList.remove('show');
    roleIndicatorBanner.className = 'account-role-indicator-banner seller-view';
    roleBannerText.innerHTML = `
      <span>🏡 <strong>Unified Client Account:</strong> Vikramaditya Rao (Owner/Seller Mode - 0% Brokerage)</span>
      <span class="role-switch-link" onclick="switchRole('buyer')">Switch to Buyer Mode ➔</span>
    `;
    switchView('explore');
  } else if (role === 'broker') {
    adminLocSelect.classList.remove('show');
    roleIndicatorBanner.className = 'account-role-indicator-banner broker-view';
    roleBannerText.innerHTML = `
      <span>💼 <strong>Principal Broker Portal:</strong> RERA-BLR-BRK-9940 | ICICI Escrow Nodal Mode</span>
      <span class="role-switch-link" onclick="switchView('escrow')">Open Escrow Desk ➔</span>
    `;
    switchView('escrow');
  } else if (role === 'admin') {
    adminLocSelect.classList.add('show');
    roleIndicatorBanner.className = 'account-role-indicator-banner admin-view';
    roleBannerText.innerHTML = `
      <span>🛡️ <strong>Regional Administrator Account:</strong> Cadastral & Escrow Authority</span>
      <span class="role-switch-link" onclick="switchView('escrow')">Review Regional Escrow ➔</span>
    `;
    switchView('escrow');
  }

  showToast(`Active Account: ${role.toUpperCase()}`);
}

/**
 * Bottom Nav & Tab Navigation
 */
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-tab-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });

  const postAdNavBtn = document.getElementById('postAdNavBtn');
  if (postAdNavBtn) {
    postAdNavBtn.addEventListener('click', () => {
      // In unified account, opening Post Ad automatically switches client to Seller mode!
      if (AppState.currentRole !== 'seller') {
        switchRole('seller');
      }
      openModal('postAdModal');
    });
  }
}

function switchView(viewName) {
  AppState.currentView = viewName;
  
  // Hide all screens
  const screens = document.querySelectorAll('.app-screen-view');
  screens.forEach(screen => {
    screen.style.display = 'none';
  });

  // Highlight active bottom tab
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  // Show target screen
  const activeScreen = document.getElementById(`view-${viewName}`);
  if (activeScreen) {
    activeScreen.style.display = 'block';
  } else {
    // Default fallback to explore
    document.getElementById('view-explore').style.display = 'block';
  }

  // Scroll to top of content
  const contentContainer = document.querySelector('.viewport-content');
  if (contentContainer) {
    contentContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Frequently Escalated Accordion
 */
function initAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.accordion-item');
      const wasOpen = parent.classList.contains('open');
      
      // Close all other accordions
      document.querySelectorAll('.accordion-item').forEach(item => item.classList.remove('open'));
      
      if (!wasOpen) {
        parent.classList.add('open');
      }
    });
  });
}

/**
 * Escrow Desk Actions: Legal Hold & Authorize Payout
 */
function initEscrowActions() {
  const standbyToggle = document.getElementById('conciergeStandbyToggle');
  if (standbyToggle) {
    standbyToggle.addEventListener('change', (e) => {
      AppState.conciergeStandbyActive = e.target.checked;
      showToast(AppState.conciergeStandbyActive 
        ? 'Legal Concierge standby ACTIVATED (Adv. Ananya K. on duty)' 
        : 'Legal Concierge standby paused');
    });
  }
}

function triggerLegalHold(escrowId) {
  const item = AppState.escrowItems.find(i => i.id === escrowId);
  if (!item) return;

  if (AppState.currentRole === 'buyer' || AppState.currentRole === 'seller') {
    showToast('⚠️ Unified client account can flag dispute. Authorizing hold requires Broker / Admin access.');
    return;
  }

  item.state = 'held';
  renderEscrowLedger();
  showToast(`🔒 ${escrowId} placed under STRICT LEGAL HOLD by ${AppState.currentRole.toUpperCase()}`);
}

function triggerAuthorizePayout(escrowId) {
  const item = AppState.escrowItems.find(i => i.id === escrowId);
  if (!item) return;

  if (AppState.currentRole !== 'broker' && AppState.currentRole !== 'admin') {
    showToast('⚠️ Only RERA Principal Broker or Regional Escrow Admin can authorize nodal bank payout.');
    return;
  }

  item.state = 'paid';
  renderEscrowLedger();
  showToast(`✅ Payout of ${item.amount} AUTHORIZED to ICICI Nodal Account for ${item.owner}!`);
}

function renderEscrowLedger() {
  const ledgerContainer = document.getElementById('escrowLedgerList');
  if (!ledgerContainer) return;

  // Filter based on admin jurisdiction if in admin role
  let itemsToDisplay = AppState.escrowItems;
  if (AppState.currentRole === 'admin' && AppState.adminJurisdiction !== 'blr-central') {
    itemsToDisplay = AppState.escrowItems.filter(item => item.locationZone === AppState.adminJurisdiction);
  }

  ledgerContainer.innerHTML = itemsToDisplay.map(item => {
    const isHeld = item.state === 'held';
    const isPaid = item.state === 'paid';

    let actionBtnMarkup = '';
    if (isPaid) {
      actionBtnMarkup = `
        <div style="background:#ECFDF5; color:#059669; padding:8px 12px; border-radius:8px; font-weight:800; font-size:0.75rem; text-align:center; width:100%;">
          ✓ Nodal Payout Disbursed & Deed Registered
        </div>
      `;
    } else if (isHeld) {
      actionBtnMarkup = `
        <div style="background:#FEE2E2; color:#DC2626; padding:8px 12px; border-radius:8px; font-weight:800; font-size:0.75rem; text-align:center; width:100%;">
          ⚠️ Locked in Arbitration - Release Pending Cadastral Verification
        </div>
      `;
    } else {
      actionBtnMarkup = `
        <button class="btn-legal-hold" onclick="triggerLegalHold('${item.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Legal Hold
        </button>
        <button class="btn-authorize-payout" onclick="triggerAuthorizePayout('${item.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Authorize Payout
        </button>
      `;
    }

    return `
      <div class="escrow-card" id="card-${item.id}">
        <div class="escrow-card-top">
          <div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span class="id-badge">${item.id}</span>
              <span class="tag-badge-escrow" style="background:#ECFDF5; color:#059669;">${item.tag}</span>
            </div>
            <div class="escrow-deal-title">${item.property}</div>
          </div>
          <div>
            <div class="escrow-deal-amount">${item.amount}</div>
            <div style="font-size:0.65rem; color:#64748B; text-align:right;">${item.statusText}</div>
          </div>
        </div>

        <div class="escrow-participants-flow">
          <div>
            <span style="font-size:0.68rem; color:#64748B;">BUYER</span><br>
            <strong>${item.buyer}</strong>
            <span style="font-size:0.65rem; color:#059669; display:block;">✓ ${item.buyerStatus}</span>
          </div>
          <div style="color:#94A3B8; font-size:1.1rem;">➔</div>
          <div style="text-align:right;">
            <span style="font-size:0.68rem; color:#64748B;">OWNER</span><br>
            <strong>${item.owner}</strong>
            <span style="font-size:0.65rem; color:#4F46E5; display:block;">✓ ${item.ownerStatus}</span>
          </div>
        </div>

        <div class="escrow-milestone-box">
          <div style="font-size:0.68rem; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.04em;">Title & Escrow Milestones</div>
          ${item.milestones.map(m => `
            <div class="milestone-item">
              <span class="milestone-text">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                ${m.text}
              </span>
              <span class="milestone-badge-passed">${m.status}</span>
            </div>
          `).join('')}
        </div>

        <div class="escrow-action-row">
          ${actionBtnMarkup}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Inquiries & Regional Admin Jurisdiction
 */
function renderJurisdictionDetails() {
  renderEscrowLedger();

  const activeInquiriesList = document.getElementById('activeInquiriesList');
  if (!activeInquiriesList) return;

  let inquiries = AppState.inquiries;
  if (AppState.currentRole === 'admin' && AppState.adminJurisdiction !== 'blr-central') {
    inquiries = AppState.inquiries.filter(i => i.locationZone === AppState.adminJurisdiction);
  }

  activeInquiriesList.innerHTML = inquiries.map(inq => `
    <div class="inquiry-card">
      <div class="inquiry-header-row">
        <div class="inquiry-id-box">
          <span class="id-badge">${inq.id}</span>
          <span class="inquiry-property-name">${inq.property}</span>
        </div>
        <span class="${inq.badgeClass}">${inq.status}</span>
      </div>

      <div class="inquiry-title">${inq.type}</div>

      <div class="assigned-officer-row">
        <div class="officer-info">
          <div class="officer-avatar">${inq.officer.substring(0, 2).toUpperCase()}</div>
          <div>
            <div class="officer-name">${inq.officer} <span style="font-size:0.68rem; font-weight:500; color:#64748B;">(${inq.role})</span></div>
            <div class="officer-time-slot">🕒 ${inq.timeSlot}</div>
          </div>
        </div>
        <div class="officer-quick-actions">
          <button class="officer-action-btn" title="Direct Phone Call" onclick="showToast('Connecting to ${inq.officer}...')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </button>
          <button class="officer-action-btn" title="Chat" onclick="showToast('Opening secure RERA chat with ${inq.officer}...')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </div>

      <div class="stepper-progress-wrap">
        <div class="stepper-bar-track">
          <div class="stepper-bar-fill" style="width: ${inq.step === 2 ? '65%' : '35%'};"></div>
        </div>
        <div class="stepper-labels">
          <span class="${inq.step >= 1 ? 'stepper-label current' : 'stepper-label'}">Slot Confirmed</span>
          <span class="${inq.step >= 2 ? 'stepper-label current' : 'stepper-label'}">Surveyor In Transit</span>
          <span class="${inq.step >= 3 ? 'stepper-label current' : 'stepper-label'}">Geo-Tag Report</span>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Concierge Interactions: 15-min Dial, Drone Survey, Token Dispute
 */
function initConciergeInteractions() {
  window.triggerCallLegalDesk = () => {
    openModal('callLegalModal');
  };

  window.triggerDroneSurvey = () => {
    openModal('droneSurveyModal');
  };

  window.triggerTokenDispute = () => {
    openModal('tokenDisputeModal');
  };
}

/**
 * Registration & Role Selection Flow (Image 5)
 */
function initRegistrationFlow() {
  const roleCards = document.querySelectorAll('.selectable-role-card');
  let chosenRegistrationRole = 'buyer_seller';

  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      chosenRegistrationRole = card.getAttribute('data-reg-role');
      
      const roleNotice = document.getElementById('registrationRoleNotice');
      if (chosenRegistrationRole === 'buyer_seller') {
        roleNotice.innerHTML = `
          <strong>Unified Account:</strong> You get Buyer/Tenant search &amp; Property Owner direct listing capabilities in 1 unified account! No separate login required.
        `;
      } else if (chosenRegistrationRole === 'broker') {
        roleNotice.innerHTML = `
          <strong>Broker Portal:</strong> Dedicated Channel Partner mandate desk, ICICI Escrow Nodal clearance, and multi-unit builder commissions. Requires RERA registration ID.
        `;
      } else if (chosenRegistrationRole === 'admin') {
        roleNotice.innerHTML = `
          <strong>Regional Admin:</strong> Location-based escrow trustee access with cadastral dispute arbitration authority for your chosen Bangalore zone.
        `;
      }
    });
  });

  const regForm = document.getElementById('landpinRegForm');
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userName = document.getElementById('regLegalName').value || 'Vikramaditya Rao';
      closeModal('registerModal');
      
      if (chosenRegistrationRole === 'buyer_seller') {
        switchRole('buyer');
        showToast(`🎉 Welcome ${userName}! Unified Client Account activated.`);
      } else if (chosenRegistrationRole === 'broker') {
        switchRole('broker');
        showToast(`💼 Welcome ${userName}! Principal Broker Portal activated.`);
      } else if (chosenRegistrationRole === 'admin') {
        switchRole('admin');
        showToast(`🛡️ Regional Administrator session activated for ${userName}.`);
      }
    });
  }
}

/**
 * Modal System
 */
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
  }
};

/**
 * Interactive Contact Handlers
 */
window.contactOwnerWhatsApp = function(name, phone) {
  showToast(`💬 Opening Direct WhatsApp chat with ${name} (${phone})`);
};

window.contactOwnerCall = function(name, phone) {
  showToast(`📞 Dialing ${name} via LandPin Direct Owner dialer: ${phone}`);
};

window.bookSiteVisit = function(propertyName) {
  openModal('siteVisitModal');
  const modalTitle = document.getElementById('siteVisitPropertyName');
  if (modalTitle) modalTitle.textContent = propertyName;
};

/**
 * Toast Notification Utility
 */
window.showToast = function(message) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast-notice');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notice';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
};

// Global filter tags
window.setIntent = function(intent, btn) {
  document.querySelectorAll('.intent-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  showToast(`Displaying: ${intent === 'buy' ? 'Properties for Sale / Direct Owner' : 'To-Let Rentals & Luxury Coliving / PGs'}`);
};

window.toggleRadarFilter = function(filterName, chip) {
  chip.classList.toggle('active');
  showToast(`Proximity Radar: ${filterName} ${chip.classList.contains('active') ? 'Filter Applied' : 'Removed'}`);
};
