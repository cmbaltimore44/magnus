import { C, isHexColor } from './theme.js';

// Category colors are stored in Supabase as hex (the web app's color picker)
// and are now drawn exactly as stored, just like the web app does.
export function categoryColor(cat) {
  return cat && isHexColor(cat.color) ? cat.color : C.muted;
}

// The web app's own category swatches (js/views/board.js COLORS), offered
// when creating a category in Magnus.
export const CATEGORY_SWATCHES = [
  { hex: '#bf5433', label: 'orange' },
  { hex: '#c9463f', label: 'red' },
  { hex: '#b8791a', label: 'amber' },
  { hex: '#2fa84f', label: 'green' },
  { hex: '#8a4fd9', label: 'purple' },
  { hex: '#d94f9e', label: 'pink' },
  { hex: '#1fb6b6', label: 'teal' },
  { hex: '#6b6b70', label: 'gray' },
];
