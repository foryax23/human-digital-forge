import {
  cloneElement,
  useId,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Props Field passes down to its control (an Input, Textarea or SelectTrigger). */
type ControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * A labelled control: label 13 px 6 px above the field, "(opțional)" inline, then one help
 * line (the error replaces the hint and says how to fix it). `status` sits inside the
 * field on the right, e.g. <Status tone="ok" size="sm">găsit la ANAF</Status>.
 * Fields stack 16 px apart, groups 24 px.
 */
export function Field({
  label,
  optional = false,
  hint,
  error,
  status,
  id,
  className,
  children,
}: {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  status?: ReactNode;
  id?: string;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const { t } = useI18n();
  const autoId = useId();
  const controlId = id ?? children.props.id ?? `field${autoId.replace(/:/g, "")}`;
  const helpId = `${controlId}-help`;
  const help = error || hint;
  const describedBy =
    [children.props["aria-describedby"], help ? helpId : null].filter(Boolean).join(" ") ||
    undefined;

  const control = cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    // Room for the status text inside the field.
    className: cn(children.props.className, status ? "pr-32" : null),
  });

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {optional ? (
          <span className="font-normal text-fg-3"> ({t("optional", "opțional")})</span>
        ) : null}
      </Label>
      {status ? (
        <div className="relative">
          {control}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {status}
          </span>
        </div>
      ) : (
        control
      )}
      {help ? (
        <p
          id={helpId}
          className={cn("text-[0.8125rem] leading-[1.45]", error ? "text-bad" : "text-fg-3")}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A checkbox with its sentence (consent, options): 16 px box, 10 px gap, 13 / 1.45 text.
 * The error adds the box's red ring and one 13 px line under the sentence.
 */
export function CheckboxField({
  label,
  error,
  id,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof Checkbox>, "children"> & {
  label: ReactNode;
  error?: ReactNode;
}) {
  const autoId = useId();
  const boxId = id ?? `check${autoId.replace(/:/g, "")}`;
  const errorId = `${boxId}-error`;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={boxId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-px"
          {...props}
        />
        <Label htmlFor={boxId} className="font-normal leading-[1.45]">
          {label}
        </Label>
      </div>
      {error ? (
        <p id={errorId} className="pl-[26px] text-[0.8125rem] leading-[1.45] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
