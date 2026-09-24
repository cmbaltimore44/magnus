export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
