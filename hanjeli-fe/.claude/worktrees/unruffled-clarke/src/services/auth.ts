const SIMULATED_LATENCY_MS = 1100;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type RequestPasswordResetInput = {
  email: string;
};

export type RequestPasswordResetResult = {
  success: true;
  email: string;
  expiresInMinutes: number;
};

export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  await delay(SIMULATED_LATENCY_MS);
  if (!input.email.includes("@")) {
    throw new Error("Format email tidak valid");
  }
  return {
    success: true,
    email: input.email,
    expiresInMinutes: 30,
  };
}

export type ConfirmPasswordResetInput = {
  token: string;
  newPassword: string;
};

export async function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
): Promise<{ success: true }> {
  await delay(SIMULATED_LATENCY_MS);
  if (!input.token) throw new Error("Token reset tidak ditemukan");
  if (input.newPassword.length < 8)
    throw new Error("Password minimal 8 karakter");
  return { success: true };
}
