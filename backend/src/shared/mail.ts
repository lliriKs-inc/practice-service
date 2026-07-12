import nodemailer from "nodemailer";
import { AppError } from "../middlewares/error.middleware";
import { config } from "./config";
import {
  appLogger,
} from "./logger/runtime-logger";
import type {
  Logger,
} from "./logger/logger.types";

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailService {
  send(params: SendMailParams): Promise<void>;
}

export interface MailTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface MailTransportMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailTransport {
  sendMail(
    message: MailTransportMessage
  ): Promise<unknown>;
}

export type MailTransportFactory = (
  options: MailTransportOptions
) => MailTransport;

export class MailDeliveryError extends AppError {
  constructor() {
    super(
      "Не удалось отправить электронное письмо",
      502,
      "MAIL_DELIVERY_FAILED"
    );

    this.name = "MailDeliveryError";
  }
}

function getRecipientDomain(
  recipient: string
): string {
  const separatorIndex =
    recipient.lastIndexOf("@");

  if (
    separatorIndex < 0 ||
    separatorIndex === recipient.length - 1
  ) {
    return "unknown";
  }

  return recipient
    .slice(separatorIndex + 1)
    .toLowerCase();
}

export class DisabledMailService
  implements MailService
{
  constructor(
    private readonly logger: Logger
  ) {}

  async send(
    params: SendMailParams
  ): Promise<void> {
    this.logger.info("Mail delivery skipped", {
      reason: "mail_disabled",
      recipientDomain:
        getRecipientDomain(params.to),
    });
  }
}

export class SmtpMailService
  implements MailService
{
  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
    private readonly logger: Logger
  ) {}

  async send(
    params: SendMailParams
  ): Promise<void> {
    const recipientDomain =
      getRecipientDomain(params.to);

    try {
      await this.transport.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      this.logger.info("Mail delivered", {
        recipientDomain,
      });
    } catch (error) {
      this.logger.error(
        "Mail delivery failed",
        {
          recipientDomain,
          error,
        }
      );

      throw new MailDeliveryError();
    }
  }
}

export interface CreateMailServiceOptions {
  mailConfig: typeof config.mail;
  logger: Logger;
  createTransport?: MailTransportFactory;
}

export function createMailService(
  options: CreateMailServiceOptions
): MailService {
  if (!options.mailConfig.enabled) {
    return new DisabledMailService(
      options.logger
    );
  }

  const createTransport =
    options.createTransport ??
    ((transportOptions) =>
      nodemailer.createTransport(
        transportOptions
      ));

  const transport = createTransport({
    host: options.mailConfig.host,
    port: options.mailConfig.port,
    secure: options.mailConfig.secure,
    auth: {
      user: options.mailConfig.user,
      pass: options.mailConfig.password,
    },
  });

  return new SmtpMailService(
    transport,
    options.mailConfig.from,
    options.logger
  );
}

export const mailService = createMailService({
  mailConfig: config.mail,
  logger: appLogger,
});

export async function sendMail(
  params: SendMailParams
): Promise<void> {
  return mailService.send(params);
}
