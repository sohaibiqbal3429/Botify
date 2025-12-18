declare module "nodemailer" {
  import type { TransportOptions } from "nodemailer/lib/smtp-transport"

  export interface SentMessageInfo {
    accepted?: string[]
    rejected?: string[]
    envelopeTime?: number
    messageTime?: number
    messageSize?: number
    response?: string
    envelope?: Record<string, unknown>
    messageId?: string
  }

  export interface Transporter {
    sendMail(mailOptions: Record<string, unknown>): Promise<SentMessageInfo>
  }

  export function createTransport(options: TransportOptions): Transporter
}
