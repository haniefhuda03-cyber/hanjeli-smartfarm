"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DropletIcon,
  InfoIcon,
  LeafIcon,
  LoaderIcon,
  MailCheckIcon,
  ShieldCheckIcon,
  SunIcon,
  ThermometerIcon,
  WifiOffIcon,
  XCircleIcon,
} from "@/components/icons/toast-icons";

export type ToastVariant = "success" | "error" | "warning" | "info";

type ToastInput = {
  title: string;
  description?: ReactNode;
  duration?: number;
  action?: ExternalToast["action"];
};

const variantClassNames: Record<ToastVariant, string> = {
  success: "toast-variant toast-variant--success",
  error: "toast-variant toast-variant--error",
  warning: "toast-variant toast-variant--warning",
  info: "toast-variant toast-variant--info",
};

function buildOptions(
  variant: ToastVariant,
  icon: ReactNode,
  input: ToastInput,
): ExternalToast {
  return {
    description: input.description,
    duration: input.duration ?? 4500,
    action: input.action,
    icon,
    className: variantClassNames[variant],
  };
}

function dispatch(
  variant: ToastVariant,
  icon: ReactNode,
  input: ToastInput,
) {
  return sonnerToast[variant](input.title, buildOptions(variant, icon, input));
}

function success(input: ToastInput) {
  return dispatch(
    "success",
    <CheckCircleIcon className="toast-icon toast-icon--success" />,
    input,
  );
}

function error(input: ToastInput) {
  return dispatch(
    "error",
    <XCircleIcon className="toast-icon toast-icon--error" />,
    input,
  );
}

function warning(input: ToastInput) {
  return dispatch(
    "warning",
    <AlertTriangleIcon className="toast-icon toast-icon--warning" />,
    input,
  );
}

function info(input: ToastInput) {
  return dispatch(
    "info",
    <InfoIcon className="toast-icon toast-icon--info" />,
    input,
  );
}

function loading(input: ToastInput) {
  return sonnerToast.loading(input.title, {
    description: input.description,
    duration: input.duration ?? Infinity,
    icon: <LoaderIcon className="toast-icon toast-icon--info" />,
    className: "toast-variant toast-variant--info",
  });
}

function dismiss(id?: string | number) {
  sonnerToast.dismiss(id);
}

const temperature = (input: ToastInput, severity: ToastVariant = "warning") =>
  dispatch(
    severity,
    <ThermometerIcon className={`toast-icon toast-icon--${severity}`} />,
    input,
  );

const humidity = (input: ToastInput, severity: ToastVariant = "info") =>
  dispatch(
    severity,
    <DropletIcon className={`toast-icon toast-icon--${severity}`} />,
    input,
  );

const sunlight = (input: ToastInput, severity: ToastVariant = "warning") =>
  dispatch(
    severity,
    <SunIcon className={`toast-icon toast-icon--${severity}`} />,
    input,
  );

const harvest = (input: ToastInput) =>
  dispatch(
    "success",
    <LeafIcon className="toast-icon toast-icon--success" />,
    input,
  );

const connectivity = (input: ToastInput) =>
  dispatch(
    "error",
    <WifiOffIcon className="toast-icon toast-icon--error" />,
    input,
  );

const passwordReset = (input: ToastInput) =>
  dispatch(
    "success",
    <ShieldCheckIcon className="toast-icon toast-icon--success" />,
    input,
  );

const emailSent = (input: ToastInput) =>
  dispatch(
    "info",
    <MailCheckIcon className="toast-icon toast-icon--info" />,
    input,
  );

function promise<T>(
  task: Promise<T>,
  messages: { loading: string; success: string; error: string },
) {
  return sonnerToast.promise(task, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    className: "toast-variant",
  });
}

export const toast = {
  success,
  error,
  warning,
  info,
  loading,
  promise,
  dismiss,
  temperature,
  humidity,
  sunlight,
  harvest,
  connectivity,
  passwordReset,
  emailSent,
};

export type ToastApi = typeof toast;
