import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border-line-2 group-[.toaster]:bg-s2 group-[.toaster]:text-fg group-[.toaster]:shadow-pop",
          description: "group-[.toast]:text-fg-2",
          actionButton: "group-[.toast]:bg-brand group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-fill-2 group-[.toast]:text-fg-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
