import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner's own distances from the bottom of the screen, plus the height of a bar stuck to the
// bottom of the page (the Artwork approval page's Send bar sets --sticky-bar-height), so toasts
// never cover that bar's buttons. Without such a bar they sit where they always did.
const OFFSET = { bottom: "calc(24px + var(--sticky-bar-height, 0px))" };
const MOBILE_OFFSET = { bottom: "calc(16px + var(--sticky-bar-height, 0px))" };

// The panel has a single light theme, so the toaster is fixed to it.
// richColors gives success and error toasts their green and red styling.
const Toaster = ({ ...props }: ToasterProps) => {
  return <Sonner theme="light" richColors closeButton offset={OFFSET} mobileOffset={MOBILE_OFFSET} {...props} />;
};

export { Toaster };
