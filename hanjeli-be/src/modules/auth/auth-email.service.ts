import { ServiceUnavailableException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { parseBoolean } from './auth.config.js';

@Injectable()
export class AuthEmailService {
  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(
    recipient: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = this.buildCallbackUrl('verify-email', token);

    await this.sendMail({
      to: recipient,
      subject: 'Verifikasi email Hanjeli SmartFarm',
      text: `Halo ${name}, buka link berikut untuk verifikasi email: ${url}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; border-radius: 12px; color: #333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #006c49; margin: 0;">🌱 Hanjeli SmartFarm</h2>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="font-size: 16px; color: #333;">Halo <strong>${name}</strong>,</p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">Silakan verifikasi email akun Hanjeli SmartFarm Anda dengan mengklik tombol di bawah ini:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                Verifikasi Email
              </a>
            </div>
            
            <p style="font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              Jika Anda tidak membuat akun ini, Anda dapat mengabaikan email ini. Tautan ini hanya berlaku sementara.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Hanjeli SmartFarm. Hak Cipta Dilindungi.</p>
          </div>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(
    recipient: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = this.buildCallbackUrl('reset-password', token);

    await this.sendMail({
      to: recipient,
      subject: 'Reset password Hanjeli SmartFarm',
      text: `Halo ${name}, buka link berikut untuk reset password: ${url}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; border-radius: 12px; color: #333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #006c49; margin: 0;">🌱 Hanjeli SmartFarm</h2>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="font-size: 16px; color: #333;">Halo <strong>${name}</strong>,</p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">Kami menerima permintaan untuk mereset kata sandi (password) akun Anda. Silakan klik tombol di bawah ini untuk melanjutkan:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              Jika Anda tidak pernah meminta reset kata sandi, abaikan pesan ini. Sistem kami akan menjaga akun Anda tetap aman.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Hanjeli SmartFarm. Hak Cipta Dilindungi.</p>
          </div>
        </div>
      `,
    });
  }

  /**
   * Email notifikasi (channel "email" pada preferensi notifikasi user) —
   * dipakai ThresholdAlertService untuk alert sensor & irigasi.
   */
  async sendNotificationEmail(
    recipient: string,
    title: string,
    description: string,
  ): Promise<void> {
    await this.sendMail({
      to: recipient,
      subject: `[Hanjeli SmartFarm] ${title}`,
      text: `${title}\n\n${description}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; border-radius: 12px; color: #333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #006c49; margin: 0;">🌱 Hanjeli SmartFarm</h2>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="font-size: 16px; color: #333; font-weight: bold;">${title}</p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">${description}</p>
            <p style="font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              Anda menerima email ini karena channel Email aktif pada preferensi notifikasi akun Anda. Nonaktifkan lewat menu Profil &rarr; Notifikasi.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Hanjeli SmartFarm. Hak Cipta Dilindungi.</p>
          </div>
        </div>
      `,
    });
  }

  async sendEmailChangeOtp(
    recipient: string,
    name: string,
    otp: string,
  ): Promise<void> {
    await this.sendMail({
      to: recipient,
      subject: 'Kode Verifikasi Ganti Email Hanjeli SmartFarm',
      text: `Halo ${name}, kode OTP Anda adalah: ${otp}. Masukkan kode ini untuk mengonfirmasi pergantian email.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; border-radius: 12px; color: #333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #006c49; margin: 0;">🌱 Hanjeli SmartFarm</h2>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="font-size: 16px; color: #333;">Halo <strong>${name}</strong>,</p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">Anda meminta untuk mengganti alamat email akun Anda. Gunakan kode 6-digit berikut untuk memverifikasi alamat email ini:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; padding: 15px 30px; background-color: #f0fdf4; color: #10b981; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 12px; border: 2px dashed #10b981;">
                ${otp}
              </div>
            </div>
            
            <p style="font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              Kode ini berlaku selama 15 menit. Jika Anda tidak merasa melakukan pergantian email, abaikan pesan ini. Sistem kami akan menjaga akun Anda tetap aman.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Hanjeli SmartFarm. Hak Cipta Dilindungi.</p>
          </div>
        </div>
      `,
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM');

    if (!host || !from) {
      throw new ServiceUnavailableException('Konfigurasi SMTP belum lengkap');
    }

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: parseBoolean(this.config.get<string>('SMTP_SECURE'), false),
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      ...options,
    });
  }

  private buildCallbackUrl(type: string, token: string): string {
    const baseUrl =
      this.config.get<string>('FRONTEND_AUTH_CALLBACK_URL') ??
      'http://localhost:3001/auth/callback';
    const url = new URL(baseUrl);

    /* Token di URL fragment (#…): tidak pernah terkirim ke server/log/Referer,
       dan frontend langsung membersihkannya dari address bar. */
    url.hash = new URLSearchParams({ type, token }).toString();

    return url.toString();
  }
}
