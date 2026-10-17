export type SearchDock = 'inline' | 'stacked' | null;
export interface SearchPlacement {left: number; top: number; width: number; dock: SearchDock}
export interface SearchRect {left: number; top: number; width: number; height: number}
export interface SearchDockGeometry {
  anchor: SearchRect; header: SearchRect; brandRight: number; navLeft: number;
  viewportWidth: number; scrollX: number; scrollY: number; wasDocked: boolean;
}
export function searchPlacement({anchor, header, brandRight, navLeft, viewportWidth, scrollX, scrollY, wasDocked}: SearchDockGeometry): SearchPlacement {
  const headerBottom = header.top + header.height;
  // A pequena faixa de tolerância evita alternância ao redor do ponto de encaixe.
  if (anchor.top > headerBottom + (wasDocked ? 24 : 12)) return {left: anchor.left + scrollX, top: anchor.top + scrollY, width: anchor.width, dock: null};
  const leftLimit = brandRight + 24;
  const rightLimit = navLeft - 24;
  const stacked = viewportWidth < 1100 || rightLimit - leftLimit < 300;
  const width = stacked ? viewportWidth - 40 : Math.min(560, rightLimit - leftLimit);
  return {
    left: stacked ? 20 : Math.max(leftLimit, Math.min((viewportWidth - width) / 2, rightLimit - width)),
    top: stacked ? headerBottom + 8 : header.top + (header.height - 44) / 2,
    width, dock: stacked ? 'stacked' : 'inline',
  };
}

export function searchDockFrames(from: SearchRect, to: SearchPlacement, scrollY: number, headerBottom: number): Keyframe[] {
  const offsetY = to.dock ? 0 : scrollY;
  const frame = (left: number, top: number, width: number, offset: number, opacity = 1) => ({left: `${left}px`, top: `${top + offsetY}px`, width: `${width}px`, offset, opacity});
  const targetTop = to.top - offsetY;
  // Em saltos grandes de rolagem, o campo anterior já saiu da tela. Revelar o
  // compacto no destino evita fazê-lo atravessar logo e navegação.
  if (to.dock && from.top < headerBottom) return [frame(to.left, to.top + 8, to.width, 0, 0), frame(to.left, to.top, to.width, 1)];
  if (to.dock) return [
    frame(from.left, from.top, from.width, 0),
    frame(to.left, Math.max(from.top, headerBottom + 8), to.width, .55),
    frame(to.left, to.top, to.width, 1),
  ];
  return [
    frame(from.left, from.top, from.width, 0),
    frame(from.left, Math.max(targetTop, headerBottom + 8), from.width, .45),
    frame(to.left, targetTop, to.width, 1),
  ];
}
