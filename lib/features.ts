/*
 * Features that are built but switched off for now. Safe to import from server and client code.
 *
 * PAYMENTS_ENABLED — payment references, admin verification and the Payments page are locked until phase 2.
 * While it is false: new clients start in Onboarding instead of Payment review, members can't submit a payment
 * reference, admins can't verify payments, and the admin Payments page shows "Coming in phase 2".
 * Set it to true to turn all of that back on.
 */
export const PAYMENTS_ENABLED = false;
