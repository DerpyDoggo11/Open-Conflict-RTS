type Props<T extends HTMLElement> = Partial<Omit<T, 'children' | 'style'>> & {
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
};

export function el<K extends keyof HTMLElementTagNameMap>(tag: K,props: Props<HTMLElementTagNameMap[K]> = {}, ...children: (HTMLElement | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, dataset, ...rest } = props;

  Object.assign(node, rest);
  if (style) Object.assign(node.style, style);
  if (dataset) Object.assign(node.dataset, dataset);

  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

export function tw(element: HTMLElement, ...classes: string[]): HTMLElement {
  element.classList.add(...classes.flatMap(c => c.split(' ').filter(Boolean)));
  return element;
}