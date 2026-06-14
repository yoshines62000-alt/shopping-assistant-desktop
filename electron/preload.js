// Preload : pont securise entre le rendu (l'UI web) et le process principal.
// Rien n'est expose pour l'instant -- l'UI parle directement au backend HTTP.
// On garde le fichier pour brancher plus tard des API natives (dialogues de
// sauvegarde, notifications systeme, etc.) via contextBridge.
window.addEventListener('DOMContentLoaded', () => {});
