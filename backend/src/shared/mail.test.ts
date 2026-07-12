import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  DisabledMailService,
  MailDeliveryError,
  SmtpMailService,
  createMailService,
} from "./mail";
import type {
  MailTransport,
} from "./mail";
import type {
  Logger,
} from "./logger";

function createLoggerMock(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("mail service", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLoggerMock();
  });

  it("does not create a transport when mail is disabled", async () => {
    const createTransport = vi.fn();

    const service = createMailService({
      mailConfig: {
        enabled: false,
      },
      logger,
      createTransport,
    });

    expect(service).toBeInstanceOf(
      DisabledMailService
    );

    await expect(
      service.send({
        to: "student@example.com",
        subject: "Subject",
        text: "Message",
      })
    ).resolves.toBeUndefined();

    expect(createTransport).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      "Mail delivery skipped",
      {
        reason: "mail_disabled",
        recipientDomain: "example.com",
      }
    );

    expect(
      JSON.stringify(
        vi.mocked(logger.info).mock.calls
      )
    ).not.toContain("student@example.com");
  });

  it("creates one configured SMTP transport", () => {
    const transport: MailTransport = {
      sendMail: vi.fn(async () => ({
        messageId: "mail-1",
      })),
    };

    const createTransport = vi.fn(
      () => transport
    );

    const service = createMailService({
      mailConfig: {
        enabled: true,
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "smtp-user",
        password: "smtp-password",
        from: "practice@example.com",
      },
      logger,
      createTransport,
    });

    expect(service).toBeInstanceOf(
      SmtpMailService
    );

    expect(createTransport).toHaveBeenCalledTimes(1);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: {
        user: "smtp-user",
        pass: "smtp-password",
      },
    });
  });

  it("sends mail through the reused transport", async () => {
    const sendMail = vi.fn(async () => ({
      messageId: "mail-1",
    }));

    const transport: MailTransport = {
      sendMail,
    };

    const createTransport = vi.fn(
      () => transport
    );

    const service = createMailService({
      mailConfig: {
        enabled: true,
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        password: "smtp-password",
        from: "practice@example.com",
      },
      logger,
      createTransport,
    });

    await service.send({
      to: "student@example.edu",
      subject: "Test task published",
      text: "Open your account",
      html: "<p>Open your account</p>",
    });

    await service.send({
      to: "second@example.edu",
      subject: "Second message",
      text: "Second body",
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);

    expect(sendMail).toHaveBeenNthCalledWith(
      1,
      {
        from: "practice@example.com",
        to: "student@example.edu",
        subject: "Test task published",
        text: "Open your account",
        html: "<p>Open your account</p>",
      }
    );

    expect(logger.info).toHaveBeenCalledWith(
      "Mail delivered",
      {
        recipientDomain: "example.edu",
      }
    );
  });

  it("converts transport failures into a stable application error", async () => {
    const transportError = new Error(
      "SMTP connection failed"
    );

    const transport: MailTransport = {
      sendMail: vi.fn(async () => {
        throw transportError;
      }),
    };

    const service = new SmtpMailService(
      transport,
      "practice@example.com",
      logger
    );

    await expect(
      service.send({
        to: "student@example.com",
        subject: "Subject",
        text: "Body",
      })
    ).rejects.toBeInstanceOf(
      MailDeliveryError
    );

    await expect(
      service.send({
        to: "student@example.com",
        subject: "Subject",
        text: "Body",
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "MAIL_DELIVERY_FAILED",
      details: null,
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Mail delivery failed",
      {
        recipientDomain: "example.com",
        error: transportError,
      }
    );

    const serializedLogs = JSON.stringify(
      vi.mocked(logger.error).mock.calls
    );

    expect(serializedLogs).not.toContain(
      "student@example.com"
    );
    expect(serializedLogs).not.toContain(
      "smtp-password"
    );
  });

  it("uses unknown for malformed recipient addresses", async () => {
    const service = new DisabledMailService(
      logger
    );

    await service.send({
      to: "invalid-address",
      subject: "Subject",
      text: "Body",
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Mail delivery skipped",
      {
        reason: "mail_disabled",
        recipientDomain: "unknown",
      }
    );
  });
});
