"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
    <Toaster
      theme="system"
      position="top-right"
      expand
      richColors={false}
      closeButton
      gap={12}
      visibleToasts={4}
      duration={4500}
      offset={{ top: "max(env(safe-area-inset-top), 16px)", right: "max(env(safe-area-inset-right), 16px)" }}
      mobileOffset={{ top: "max(env(safe-area-inset-top), 12px)", right: "max(env(safe-area-inset-right), 12px)", left: "max(env(safe-area-inset-left), 12px)" }}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast__title",
          description: "app-toast__description",
          actionButton: "app-toast__action",
          cancelButton: "app-toast__cancel",
          closeButton: "app-toast__close",
          icon: "app-toast__icon",
          content: "app-toast__content",
        },
      }}
    />
  );
}
