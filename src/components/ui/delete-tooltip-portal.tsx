export type DeleteTooltipAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function DeleteTooltipPortal(_: {
  visible: boolean;
  anchor: DeleteTooltipAnchor | null;
  text: string;
}) {
  return null;
}
