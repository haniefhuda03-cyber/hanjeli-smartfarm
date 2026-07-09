# Tech Stack & Guidelines

* **Frontend Framework:** Next.js (App Directory)
* **Styling:** Tailwind CSS with a primary color theme around `#105446` (dark green) and `#ADF1A5` (light green).
* **Icons:** `lucide-react`
* **Components:** Custom lightweight components often using standard `div` abstractions or generic UI elements (e.g. from Shadcn-like blocks, `sonner` for active alerts).
* **Charts:** `recharts` for monitoring metrics.
* **Typing:** Strict TypeScript typing pattern is strongly utilized.
* **Component Architecture:** Focus on functional components with hooks (`useState`, `useEffect`, `useCallback`)
* **State Management:** Handled locally within contexts or component state since this is purely a frontend simulator implementation for now. Back-end simulations use `setTimeout` and predefined logic paths.