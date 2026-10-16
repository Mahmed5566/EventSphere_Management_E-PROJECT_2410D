// Role navigation model shared by the dashboard shell.
// Add a new screen here and the sidebar picks it up automatically.

export const ROLE_NAV = {
  "admin": [
    [
      "overview",
      "Overview",
      "fa-gauge-high"
    ],
    [
      "events",
      "Events",
      "fa-calendar-days"
    ],
    [
      "venues",
      "Venues & Maps",
      "fa-map-location-dot"
    ],
    [
      "booths",
      "Booth Designer",
      "fa-table-cells-large"
    ],
    [
      "exhibitors",
      "Exhibitors",
      "fa-building"
    ],
    [
      "tickets",
      "Ticketing",
      "fa-ticket"
    ],
    [
      "staff",
      "Staff & Payroll",
      "fa-users-gear"
    ],
    [
      "sessions",
      "Sessions",
      "fa-microphone-lines"
    ],
    [
      "messages",
      "Messages",
      "fa-comments"
    ],
    [
      "analytics",
      "Analytics",
      "fa-chart-line"
    ],
    [
      "profile",
      "My Profile",
      "fa-user-circle"
    ],
    [
      "ai",
      "AI Copilot",
      "fa-wand-magic-sparkles"
    ],
    [
      "enterprise",
      "Enterprise Hub",
      "fa-crown"
    ],
    [
      "advanced",
      "Pro Operations",
      "fa-layer-group"
    ],
    [
      "experience",
      "Experience OS",
      "fa-rocket"
    ]
  ],
  "organizer": [
    [
      "overview",
      "Overview",
      "fa-gauge-high"
    ],
    [
      "events",
      "My Events",
      "fa-calendar-days"
    ],
    [
      "venues",
      "Venues",
      "fa-map-location-dot"
    ],
    [
      "booths",
      "Booth Designer",
      "fa-table-cells-large"
    ],
    [
      "exhibitors",
      "Exhibitors",
      "fa-building"
    ],
    [
      "tickets",
      "Tickets & Sales",
      "fa-ticket"
    ],
    [
      "staff",
      "Staff",
      "fa-users-gear"
    ],
    [
      "sessions",
      "Sessions",
      "fa-microphone-lines"
    ],
    [
      "messages",
      "Messages",
      "fa-comments"
    ],
    [
      "profile",
      "My Profile",
      "fa-user-circle"
    ],
    [
      "ai",
      "AI Copilot",
      "fa-wand-magic-sparkles"
    ],
    [
      "enterprise",
      "Enterprise Hub",
      "fa-crown"
    ],
    [
      "advanced",
      "Pro Operations",
      "fa-layer-group"
    ],
    [
      "experience",
      "Experience OS",
      "fa-rocket"
    ]
  ],
  "staff": [
    [
      "overview",
      "Overview",
      "fa-gauge-high"
    ],
    [
      "experience",
      "Operations Center",
      "fa-helmet-safety"
    ],
    [
      "sessions",
      "Sessions",
      "fa-microphone-lines"
    ],
    [
      "messages",
      "Messages",
      "fa-comments"
    ],
    [
      "profile",
      "My Profile",
      "fa-user-circle"
    ]
  ],
  "exhibitor": [
    [
      "overview",
      "Overview",
      "fa-gauge-high"
    ],
    [
      "events",
      "Events",
      "fa-calendar-days"
    ],
    [
      "booths",
      "My Booths",
      "fa-store"
    ],
    [
      "sessions",
      "Sessions",
      "fa-microphone-lines"
    ],
    [
      "messages",
      "Messages",
      "fa-comments"
    ],
    [
      "profile",
      "My Profile",
      "fa-user-circle"
    ],
    [
      "ai",
      "AI Copilot",
      "fa-wand-magic-sparkles"
    ],
    [
      "enterprise",
      "Event Hub",
      "fa-crown"
    ],
    [
      "experience",
      "My Experience",
      "fa-rocket"
    ]
  ],
  "attendee": [
    [
      "overview",
      "Overview",
      "fa-gauge-high"
    ],
    [
      "events",
      "Discover Events",
      "fa-compass"
    ],
    [
      "tickets",
      "My Tickets",
      "fa-ticket"
    ],
    [
      "sessions",
      "Sessions",
      "fa-microphone-lines"
    ],
    [
      "messages",
      "Messages",
      "fa-comments"
    ],
    [
      "feedback",
      "Feedback",
      "fa-star"
    ],
    [
      "certificates",
      "Certificates",
      "fa-certificate"
    ],
    [
      "ai",
      "AI Copilot",
      "fa-wand-magic-sparkles"
    ],
    [
      "enterprise",
      "Event Hub",
      "fa-crown"
    ],
    [
      "experience",
      "My Experience",
      "fa-rocket"
    ]
  ]
};

// Planning modules added by the EventSphere Planning upgrade. Each surface is
// offered only to the roles that own or operate the underlying records; the
// backend re-checks authorization on every request regardless of the menu.
const PLANNING_NAV = {
  admin: [
    ["reports", "Reports", "fa-chart-pie"],
    ["checkin", "Check-in", "fa-qrcode"],
    ["calendar", "Calendar", "fa-calendar-check"],
    ["budget", "Budget", "fa-wallet"],
    ["tasks", "Team Tasks", "fa-list-check"],
    ["activity", "Activity", "fa-bell"]
  ],
  organizer: [
    ["reports", "Reports", "fa-chart-pie"],
    ["checkin", "Check-in", "fa-qrcode"],
    ["calendar", "Calendar", "fa-calendar-check"],
    ["budget", "Budget", "fa-wallet"],
    ["tasks", "Team Tasks", "fa-list-check"],
    ["activity", "Activity", "fa-bell"]
  ],
  staff: [
    ["checkin", "Check-in", "fa-qrcode"],
    ["calendar", "Calendar", "fa-calendar-check"],
    ["tasks", "Team Tasks", "fa-list-check"],
    ["activity", "Activity", "fa-bell"]
  ],
  exhibitor: [
    ["calendar", "Calendar", "fa-calendar-check"],
    ["activity", "Activity", "fa-bell"]
  ],
  attendee: [
    ["calendar", "Calendar", "fa-calendar-check"],
    ["activity", "Activity", "fa-bell"]
  ]
};

Object.keys(ROLE_NAV).forEach(role => {
  ROLE_NAV[role] = [...ROLE_NAV[role], ...(PLANNING_NAV[role] || [])];
});

// Settings + Help are available to every role. Appending them here keeps the
// sidebar automatically in sync without repeating the entries for each role.
const COMMON_NAV = [
  ["settings", "Settings", "fa-gear"],
  ["help", "Help & Contact", "fa-circle-question"]
];
Object.keys(ROLE_NAV).forEach(role => {
  ROLE_NAV[role] = [...ROLE_NAV[role], ...COMMON_NAV];
});
