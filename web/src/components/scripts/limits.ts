const KB = 1024
const MB = 1024 * KB

export const LIMITS = {
  longTextMax: 20_000,

  auth: { nicknameMin: 3, nicknameMax: 50, emailMax: 255, passwordMin: 8, passwordMax: 255 },

  profile: {
    nicknameMax: 50, realNameMax: 100, countryMax: 50, cityMax: 50,
    workplaceMax: 100, roleMax: 50, descriptionMax: 2000, skillsMax: 250,
  },

  member: { roleMin: 2, roleMax: 50 },
  project: { titleMax: 50, shortDescriptionMax: 150 },
  vacancy: { titleMax: 50, descriptionMax: 500, descriptionMaxLines: 10, tagsMaxLines: 2 },

  event: {
    titleMax: 50, shortDescriptionMax: 150,
    participantLimitMin: 1, participantLimitMax: 100_000,
    stagesMax: 20, stageTitleMax: 50,
    formFieldsMax: 50, formLabelMax: 100,
    applicationAnswerMax: 2000, decisionCommentMax: 1000,
  },

  search: { userQueryMin: 2, userQueryMax: 50, projectQueryMin: 2, projectQueryMax: 50 },
  upload: { avatarMaxBytes: 5 * MB, mediaTotalMaxBytes: 50 * MB },
  report: { messageMax: 1024, attachmentsMaxBytes: 50 * MB },
} as const

export const TIMING = {
  toastMs: 3000,  
  draftAutosaveMs: 1000,
  usersRefreshMs: 120_000,
  copiedMarkMs: 1500,
  messageHighlightMs: 1200,
} as const

export const LAYOUT = {
  shortBreakpoint: 965, 
  headerNicknameChars: 15,
  headerEmailChars: 25,
  notificationsPreview: 25,
} as const

export const maxChars = (n: number) => `Максимум ${n} символов`
export const minChars = (n: number) => `Минимум ${n} символов`