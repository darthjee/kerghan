import type nodemailer from 'nodemailer';

/**
 * The concrete nodemailer transporter the Mail module wires and injects, or
 * `null` when outbound email is not configured (email disabled).
 *
 * Derived from `createTransport`'s own return type rather than the bare
 * `Transporter`, which resolves to `Transporter<any>` and would otherwise
 * collapse `Transporter | null` down to `any`.
 */
export type MailTransport = ReturnType<typeof nodemailer.createTransport> | null;
