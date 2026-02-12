import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  CloudBaseCollections,
  getCloudBaseDatabase,
  nowISO,
} from "@/lib/database/cloudbase-client";

export type EmailVerificationPurpose = "register" | "reset_password";

type EmailCodeRecord = {
  _id?: string;
  email: string;
  purpose: EmailVerificationPurpose;
  codeHash: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

type SendCodeErrorCode =
  | "EMAIL_SERVICE_NOT_CONFIGURED"
  | "SEND_TOO_FREQUENT"
  | "SEND_FAILED";

type VerifyCodeErrorCode =
  | "CODE_NOT_FOUND"
  | "CODE_INVALID"
  | "CODE_EXPIRED"
  | "CODE_CONSUME_FAILED";

type SendCodeSuccess = {
  success: true;
  expiresInSeconds: number;
};

type SendCodeFailure = {
  success: false;
  code: SendCodeErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

type VerifyCodeSuccess = {
  success: true;
};

type VerifyCodeFailure = {
  success: false;
  code: VerifyCodeErrorCode;
  message: string;
};

export type SendEmailCodeResult = SendCodeSuccess | SendCodeFailure;
export type VerifyEmailCodeResult = VerifyCodeSuccess | VerifyCodeFailure;

const EMAIL_CODE_COLLECTION = CloudBaseCollections.AUTH_EMAIL_CODES;

const CODE_EXPIRE_MINUTES = readPositiveInt(
  process.env.AUTH_EMAIL_CODE_EXPIRE_MINUTES,
  10
);
const RESEND_COOLDOWN_SECONDS = readPositiveInt(
  process.env.AUTH_EMAIL_CODE_RESEND_SECONDS,
  60
);

let cachedTransporter: nodemailer.Transporter | null = null;
let emailCodeCollectionReadyPromise: Promise<void> | null = null;

function isCollectionNotExistError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "DATABASE_COLLECTION_NOT_EXIST"
  );
}

function isCollectionAlreadyExistsError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: string }).code
      : undefined;
  const message =
    typeof error === "object" && error !== null
      ? String((error as { message?: string }).message ?? "")
      : "";

  return (
    code === "DATABASE_COLLECTION_EXIST" ||
    message.includes("already exist") ||
    message.includes("already exists")
  );
}

async function ensureEmailCodeCollectionReady(): Promise<void> {
  if (emailCodeCollectionReadyPromise) {
    return emailCodeCollectionReadyPromise;
  }

  emailCodeCollectionReadyPromise = (async () => {
    const db = getCloudBaseDatabase();

    try {
      await db.collection(EMAIL_CODE_COLLECTION).limit(1).get();
      return;
    } catch (error) {
      if (!isCollectionNotExistError(error)) {
        throw error;
      }
    }

    try {
      await db.createCollection(EMAIL_CODE_COLLECTION);
    } catch (error) {
      if (!isCollectionAlreadyExistsError(error)) {
        throw error;
      }
    }
  })();

  try {
    await emailCodeCollectionReadyPromise;
  } catch (error) {
    emailCodeCollectionReadyPromise = null;
    throw error;
  }
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildCodeHash(
  email: string,
  purpose: EmailVerificationPurpose,
  code: string
): string {
  const secret = process.env.JWT_SECRET || "email-code-fallback-secret";
  return crypto
    .createHash("sha256")
    .update(`${email}|${purpose}|${code}|${secret}`)
    .digest("hex");
}

function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function getSmtpConfig() {
  const host = process.env.AUTH_EMAIL_SMTP_HOST;
  const portRaw = process.env.AUTH_EMAIL_SMTP_PORT;
  const user = process.env.AUTH_EMAIL_SMTP_USER;
  const pass = process.env.AUTH_EMAIL_SMTP_PASS;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!host || !portRaw || !user || !pass || !from) {
    return {
      ok: false as const,
      message:
        "Missing AUTH_EMAIL_SMTP_HOST, AUTH_EMAIL_SMTP_PORT, AUTH_EMAIL_SMTP_USER, AUTH_EMAIL_SMTP_PASS or AUTH_EMAIL_FROM",
    };
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return {
      ok: false as const,
      message: "AUTH_EMAIL_SMTP_PORT is invalid",
    };
  }

  return {
    ok: true as const,
    host,
    port,
    user,
    pass,
    from,
    secure: port === 465,
  };
}

function getTransporter(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}): nodemailer.Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

function buildCnEmailContent(
  purpose: EmailVerificationPurpose,
  code: string
): {
  subject: string;
  text: string;
  html: string;
} {
  const brandName = process.env.AUTH_EMAIL_BRAND_NAME?.trim() || "辰汇个性推荐";
  const isRegister = purpose === "register";
  const actionText = isRegister ? "注册账号" : "找回密码";
  const subject = `【${brandName}】${isRegister ? "注册验证码" : "找回密码验证码"}`;
  const minutes = CODE_EXPIRE_MINUTES;

  const text = [
    `${brandName} 验证码通知`,
    `您正在进行${actionText}操作。`,
    `验证码：${code}`,
    `有效期：${minutes} 分钟`,
    "请勿向任何人泄露验证码。",
    "若非本人操作，请忽略本邮件。",
  ].join("\n");

  const html = `
<div style="background:#f5f7fa;padding:24px 0;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#111827;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700;">${brandName}</div>
    <div style="padding:24px;line-height:1.7;font-size:14px;">
      <p style="margin:0 0 12px;">您好，</p>
      <p style="margin:0 0 12px;">您正在进行 <strong>${actionText}</strong> 操作，验证码如下：</p>
      <div style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-radius:8px;text-align:center;">
        <span style="font-size:30px;letter-spacing:8px;font-weight:700;color:#111827;">${code}</span>
      </div>
      <p style="margin:0 0 8px;">验证码 <strong>${minutes} 分钟</strong> 内有效，请勿泄露给他人。</p>
      <p style="margin:0 0 8px;">若非本人操作，请忽略本邮件。</p>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  </div>
</div>`;

  return { subject, text, html };
}

async function getLatestCodeRecord(
  email: string,
  purpose: EmailVerificationPurpose,
  includeConsumed: boolean
): Promise<EmailCodeRecord | null> {
  const db = getCloudBaseDatabase();
  const whereCondition: Record<string, unknown> = {
    email,
    purpose,
  };

  if (!includeConsumed) {
    whereCondition.consumedAt = null;
  }

  const result = await db
    .collection(EMAIL_CODE_COLLECTION)
    .where(whereCondition)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  const records = (result?.data ?? []) as EmailCodeRecord[];
  return records[0] ?? null;
}

export async function sendEmailVerificationCode(params: {
  email: string;
  purpose: EmailVerificationPurpose;
}): Promise<SendEmailCodeResult> {
  await ensureEmailCodeCollectionReady();

  const email = normalizeEmail(params.email);
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig.ok) {
    return {
      success: false,
      code: "EMAIL_SERVICE_NOT_CONFIGURED",
      message: smtpConfig.message,
    };
  }

  const latest = await getLatestCodeRecord(email, params.purpose, true);
  if (latest?.createdAt) {
    const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
    const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;

    if (elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return {
        success: false,
        code: "SEND_TOO_FREQUENT",
        message: `Please retry after ${retryAfterSeconds} seconds`,
        retryAfterSeconds,
      };
    }
  }

  const code = generateSixDigitCode();
  const createdAt = nowISO();
  const expiresAt = new Date(
    Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000
  ).toISOString();

  const db = getCloudBaseDatabase();
  const codesCollection = db.collection(EMAIL_CODE_COLLECTION);

  const addResult = await codesCollection.add({
    email,
    purpose: params.purpose,
    codeHash: buildCodeHash(email, params.purpose, code),
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    consumedAt: null,
  });

  try {
    const transporter = getTransporter(smtpConfig);
    const content = buildCnEmailContent(params.purpose, code);

    await transporter.sendMail({
      from: smtpConfig.from,
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    return {
      success: true,
      expiresInSeconds: CODE_EXPIRE_MINUTES * 60,
    };
  } catch (error) {
    if (addResult?.id) {
      await codesCollection
        .doc(addResult.id)
        .remove()
        .catch(() => undefined);
    }

    return {
      success: false,
      code: "SEND_FAILED",
      message: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function consumeEmailVerificationCode(params: {
  email: string;
  purpose: EmailVerificationPurpose;
  code: string;
}): Promise<VerifyEmailCodeResult> {
  await ensureEmailCodeCollectionReady();

  const email = normalizeEmail(params.email);
  const db = getCloudBaseDatabase();
  const result = await db
    .collection(EMAIL_CODE_COLLECTION)
    .where({
      email,
      purpose: params.purpose,
      consumedAt: null,
    })
    .orderBy("createdAt", "desc")
    .limit(8)
    .get();

  const records = (result?.data ?? []) as EmailCodeRecord[];
  if (records.length === 0) {
    return {
      success: false,
      code: "CODE_NOT_FOUND",
      message: "Verification code does not exist",
    };
  }

  const now = Date.now();
  const targetHash = buildCodeHash(email, params.purpose, params.code.trim());

  let hasUnexpiredRecord = false;
  let matchedRecord: EmailCodeRecord | null = null;

  for (const record of records) {
    const expiresAtMs = new Date(record.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now) {
      continue;
    }

    hasUnexpiredRecord = true;
    if (record.codeHash === targetHash) {
      matchedRecord = record;
      break;
    }
  }

  if (!matchedRecord) {
    if (!hasUnexpiredRecord) {
      return {
        success: false,
        code: "CODE_EXPIRED",
        message: "Verification code has expired",
      };
    }

    return {
      success: false,
      code: "CODE_INVALID",
      message: "Verification code is invalid",
    };
  }

  if (!matchedRecord._id) {
    return {
      success: false,
      code: "CODE_CONSUME_FAILED",
      message: "Verification code consume failed",
    };
  }

  try {
    await db.collection(EMAIL_CODE_COLLECTION).doc(matchedRecord._id).update({
      consumedAt: nowISO(),
      updatedAt: nowISO(),
    });

    return { success: true };
  } catch {
    return {
      success: false,
      code: "CODE_CONSUME_FAILED",
      message: "Verification code consume failed",
    };
  }
}
