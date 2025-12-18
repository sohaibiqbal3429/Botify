import nodemailer from "nodemailer"
import { normalizeSMTPError } from "./smtp-error"

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number.parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendOTPEmail(email: string, otp: string, purpose = "registration") {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP configuration missing. Please set SMTP_USER and SMTP_PASS environment variables.")
  }

  const transporter = createTransporter()
  const subject = `Your 5gBotify Verification Code`

  const safePurpose = String(purpose || "verification").replace(/[<>]/g, "")

  const html = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title>5gBotify OTP</title>
    </head>
    <body style="margin:0; padding:0; background:#0b1020; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, 'Helvetica Neue', Helvetica, sans-serif;">
      <!-- Preheader (hidden) -->
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
        Your 5gBotify verification code is ${otp}. Expires in 10 minutes.
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020; padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
              <!-- Header -->
              <tr>
                <td style="padding: 10px 0 18px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="left" style="color:#e5e7eb; font-size:16px; letter-spacing:0.3px;">
                        <span style="display:inline-block; padding:10px 14px; border-radius:14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10);">
                          <span style="font-weight:700; color:#ffffff;">5g</span><span style="font-weight:700; color:#93c5fd;">Botify</span>
                        </span>
                      </td>
                      <td align="right" style="color:#9ca3af; font-size:12px;">
                        Security • OTP
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="border-radius:22px; overflow:hidden; border:1px solid rgba(255,255,255,0.10);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <!-- Gradient Banner -->
                    <tr>
                      <td style="padding:22px 22px 18px 22px; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #06b6d4 100%);">
                        <div style="color:#ffffff; font-weight:800; font-size:20px; line-height:1.2;">
                          Verify your account
                        </div>
                        <div style="color: rgba(255,255,255,0.85); margin-top:6px; font-size:13px; line-height:1.4;">
                          Use this one-time code to complete <b style="color:#fff;">${safePurpose}</b>.
                        </div>
                      </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                      <td style="padding:22px; background: rgba(255,255,255,0.06);">
                        <div style="color:#e5e7eb; font-size:14px; line-height:1.6;">
                          Enter the code below. It expires in <b>10 minutes</b>.
                        </div>

                        <!-- OTP Box -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                          <tr>
                            <td align="center" style="
                              background: rgba(0,0,0,0.25);
                              border: 1px solid rgba(255,255,255,0.14);
                              border-radius:18px;
                              padding:18px 14px;
                              ">
                              <div style="
                                font-size:34px;
                                font-weight:900;
                                letter-spacing:10px;
                                color:#ffffff;
                                text-shadow: 0 8px 24px rgba(0,0,0,0.35);
                                ">
                                ${otp}
                              </div>
                              <div style="margin-top:10px; font-size:12px; color:#cbd5e1;">
                                Don’t share this code with anyone.
                              </div>
                            </td>
                          </tr>
                        </table>

                        <!-- Tips -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                          <tr>
                            <td style="padding:14px 16px; border-radius:16px; background: rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.14);">
                              <div style="font-size:12px; color:#d1d5db; line-height:1.6;">
                                If you didn’t request this code, you can safely ignore this email.  
                                For extra safety, change your password if you suspect suspicious activity.
                              </div>
                            </td>
                          </tr>
                        </table>

                      </td>
                    </tr>

                    <!-- Footer strip -->
                    <tr>
                      <td style="padding:14px 22px; background: rgba(0,0,0,0.25); border-top:1px solid rgba(255,255,255,0.08);">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:12px; color:#9ca3af;">
                              © 2025 5gBotify • All rights reserved
                            </td>
                            <td align="right" style="font-size:12px; color:#9ca3af;">
                              This is an automated message
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- Bottom spacing -->
              <tr><td style="height:18px;"></td></tr>

              <!-- Plain footer note -->
              <tr>
                <td style="text-align:center; color:#6b7280; font-size:11px; line-height:1.5;">
                  Having trouble? Reply to this email to contact support.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `

  try {
    await transporter.sendMail({
      from: `"5gBotify" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    })
  } catch (error) {
    console.error("Email sending failed:", error)
    const normalized = normalizeSMTPError(error)
    const smtpError = new Error(normalized.message)
    ;(smtpError as any).code = (error as any)?.code ?? normalized.code
    ;(smtpError as any).responseCode = (error as any)?.responseCode ?? normalized.status
    ;(smtpError as any).hint = normalized.hint
    ;(smtpError as any).debug = normalized.debug
    throw smtpError
  }
}
