/* The one place that sets how long a password must be. Safe to import from server and client code. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** True when a new password has an acceptable length. */
export const validPassword = (password: string) => password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;

/** Shown when a new password is too short or too long. */
export const passwordRuleText = `at least ${PASSWORD_MIN} characters`;
