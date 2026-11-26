import * as React from "react";
import * as AlignAlert from "@/components/ui/alert";
import { RiErrorWarningFill, RiInformationFill, RiCheckboxCircleFill } from "@remixicon/react";

export type AlertProps = { status: "error" | "information" | "success"; title: string; children?: React.ReactNode; live?: boolean };

const icons = { error: RiErrorWarningFill, information: RiInformationFill, success: RiCheckboxCircleFill };

/** A message box. Errors use role="alert" so they are announced at once. */
export function Alert({ status, title, children, live = status === "error" }: AlertProps) {
  return (
    <AlignAlert.Root variant="lighter" status={status} size="large" role={live ? "alert" : "status"}>
      <AlignAlert.Icon as={icons[status]} aria-hidden />
      <div className="grid gap-1">
        <p className="text-label-md">{title}</p>
        {children ? <div className="text-paragraph-md">{children}</div> : null}
      </div>
    </AlignAlert.Root>
  );
}
