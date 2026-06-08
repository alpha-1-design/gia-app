export const genId = () => {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
};
