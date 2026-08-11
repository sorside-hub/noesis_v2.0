export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

const PROPERTIES_TO_COPY = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordBreak',
  'wordWrap',
] as const;

/**
  * Calculates caret (X, Y) coordinates and height inside a HTMLTextAreaElement or HTMLInputElement.
  */
export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0px';
  style.left = '-9999px';

  PROPERTIES_TO_COPY.forEach((prop) => {
    (style as any)[prop] = computed.getPropertyValue(prop);
  });

  // Handle Firefox scrollbars
  const isFirefox = typeof (window as any).mozInnerScreenX !== 'undefined';
  if (isFirefox) {
    if (element.scrollHeight > parseInt(computed.height || '0', 10)) {
      style.overflowY = 'scroll';
    }
  } else {
    style.overflow = 'hidden';
  }

  div.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position, position + 1) || '.';
  div.appendChild(span);

  const borderTop = parseInt(computed.borderTopWidth || '0', 10);
  const borderLeft = parseInt(computed.borderLeftWidth || '0', 10);
  const parsedLineHeight = parseInt(computed.lineHeight || '0', 10);
  const fontSz = parseInt(computed.fontSize || '14', 10);

  const lineHeight = !isNaN(parsedLineHeight) && parsedLineHeight > 0
    ? parsedLineHeight
    : fontSz * 1.4;

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + borderTop,
    left: span.offsetLeft + borderLeft,
    height: span.offsetHeight || lineHeight,
  };

  document.body.removeChild(div);

  return coordinates;
}
