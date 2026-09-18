// What /api/v1/me answers, for specs that stub the API.
export const ALL_PERMISSIONS = ['settings.manage', 'users.manage', 'libraries.manage', 'system.manage']

export const DEFAULT_PREFERENCES = {
  language: null, audioLanguage: null, subtitleLanguage: null, subtitleMode: 'auto', quality: 'original', autoplayNext: true
}

export function account (overrides = {}) {
  return {
    id: 1,
    username: 'robin',
    name: 'Robin',
    email: 'robin@example.com',
    avatar: null,
    publicProfile: true,
    passwordlessLocal: false,
    groupId: 1,
    hasPassword: true,
    group: { id: 1, name: 'Administrators' },
    permissions: ALL_PERMISSIONS,
    ...overrides,
    preferences: { ...DEFAULT_PREFERENCES, ...overrides.preferences }
  }
}

export const member = (overrides = {}) => account({
  id: 2, username: 'bob', name: 'Bob', groupId: 2, group: { id: 2, name: 'Users' }, permissions: [], ...overrides
})
