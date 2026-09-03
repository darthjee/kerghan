# mail.service.ts: the send() API

Create `backend/src/mail/mail.service.ts` — the `@Injectable()` `MailService` that wraps the
injected transporter. It never imports `nodemailer`; it receives the transporter and the frozen
`MailConfig` by DI (tokens defined in Step 05).

## Shape

- Private `readonly` fields declared and assigned in the constructor body (match
  `password-reset.service.ts` style, satisfies `eslint-plugin-sort-class-members`).
- `private readonly logger = new Logger(MailService.name)` — Nest's built-in `Logger`.
- Constructor params: the transporter (typed `nodemailer.Transporter`, injected via
  `@Inject(MAIL_TRANSPORT)`) and `config: MailConfig` (`@Inject(MAIL_CONFIG)`). When disabled the
  transporter injection is `null` — type it `Transporter | null`.

## `SendMailParams` / `SendMailResult`

Define and export these interfaces (here or in `mail.config.ts` — keep them with the service):

```ts
export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}
export interface SendMailResult {
  status: 'sent' | 'skipped';
  messageId?: string;
}
```

## `async send(params: SendMailParams): Promise<SendMailResult>`

1. **Disabled** (`!this.config.enabled`) → `this.logger.debug(\`email disabled; skipping message
   to ${params.to} subj=${params.subject}\`)`; return `{ status: 'skipped' }`. Do not touch the
   transporter.
2. **Guard `to`** → if `!params.to || !params.to.trim()` throw
   `new Error("mail: 'to' is required")`.
3. **Header-injection guard** → if `to`, `subject`, or the effective `from` contains `\r` or
   `\n`, throw `new Error('mail: header field contains a newline')`.
4. `const from = params.from ?? this.config.from`.
5. `try { const info = await this.transporter!.sendMail({ from, to, subject, text, html }); }`
   - If `info.rejected?.length && !info.accepted?.length` → throw
     `new Error(\`mail: recipient rejected: ${info.rejected.join(', ')}\`)` (caught below).
   - Else return `{ status: 'sent', messageId: info.messageId }`.
6. **`catch (err)`** → `this.logger.error(\`mail send failed to ${params.to} subj=${params.subject}: ${err}\`)`
   then `throw err`. Never include `text` / `html` in the log.

Best-effort swallowing is the caller's job (#39), not here — a configured send that fails
rejects.

Keep under 300 lines / complexity 10 — `send` has a few branches; if the linter flags
complexity, extract the two guards (steps 2–3) into a small private `#assertSendable(params)`
method.

## Files to Change

- `backend/src/mail/mail.service.ts` — new
