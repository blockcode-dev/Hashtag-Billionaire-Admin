import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// The panel has a single light theme, so the toaster is fixed to it.
// richColors gives success and error toasts their green and red styling.
const Toaster = ({ ...props }: ToasterProps) => {
  return <Sonner theme="light" richColors closeButton {...props} />;
};

export { Toaster };
